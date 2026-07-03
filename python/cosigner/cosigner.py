"""Fordefi CoSigner — programmatic transaction validation that augments Fordefi Policy.

Fordefi notifies this service (via webhook) whenever a transaction is waiting for
approval. The CoSigner fetches the full transaction from the Fordefi API, runs it
through the rules in rules/, and approves or aborts it accordingly. This lets you
enforce checks that native Policy rules cannot express, such as validating a deeply
nested EIP-712 field or a decoded calldata argument.

Response semantics: any 2xx tells Fordefi the event is handled (decision made or
nothing to do); any other status makes Fordefi retry the webhook with backoff.
"""

import json
import logging
import os
from http import HTTPStatus
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fordefi import Config, FordefiAPI, FordefiAPIError, SignatureVerifier
from rules import ALL_RULES, RuleContext, Verdict, decode_calldata, run_rules


def configure_logging() -> None:
    # Named loggers ("cosigner", "cosigner.api", "cosigner.rules") sit under the
    # "cosigner" hierarchy and propagate to the root handler set up here, so the
    # whole service shares one timestamped format. This is separate from uvicorn's
    # own loggers, so access logs are unaffected. Set LOG_LEVEL=DEBUG for more detail.
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    formatter = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s  %(message)s")

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    handlers: list[logging.Handler] = [console]

    # Persist every log line to a file for auditability. Rotates daily at midnight
    # so each UTC day gets its own dated file (cosigner.log, cosigner.log.2026-07-03,
    # ...); LOG_RETENTION_DAYS old files are pruned. LOG_DIR defaults to a
    # project-relative ./live-logs (writing to filesystem-root /live-logs would need
    # elevated permissions); point it at an absolute path in production.
    log_dir = Path(os.environ.get("LOG_DIR", "./live-logs"))
    log_dir.mkdir(parents=True, exist_ok=True)
    file_handler = TimedRotatingFileHandler(
        log_dir / "cosigner.log",
        when="midnight",
        utc=True,
        backupCount=int(os.environ.get("LOG_RETENTION_DAYS", "90")),
    )
    file_handler.setFormatter(formatter)
    handlers.append(file_handler)

    logging.basicConfig(level=level, handlers=handlers)
    logging.getLogger("cosigner").info("Writing audit logs to %s", log_dir.resolve())


configure_logging()
logger = logging.getLogger("cosigner")

config = Config()
fordefi_api = FordefiAPI(Config.FORDEFI_API_BASE_URL, config.api_user_token)
signature_verifier = SignatureVerifier(config.fordefi_public_key)

app = FastAPI()


def get_source_ip(request: Request) -> str:
    # X-Forwarded-For is only trustworthy behind a proxy you control (ngrok, load
    # balancer); when exposed directly, request.client.host is the real source.
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/health")
async def health_check():
    return {"status": "online"}


@app.post("/")
async def handle_webhook(request: Request):
    raw_body = await request.body()

    source_ip = get_source_ip(request)
    if source_ip not in Config.ALLOWED_SOURCE_IPS:
        logger.warning("Rejected webhook from unauthorized IP: %s", source_ip)
        raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Forbidden: IP not allowed")

    signature = request.headers.get("X-Signature")
    if not signature:
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Missing signature")
    if not signature_verifier.is_valid_signature(signature, raw_body):
        logger.warning("Rejected webhook with invalid signature from %s", source_ip)
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Invalid signature")

    try:
        webhook_payload = json.loads(raw_body)
        logger.info(
            "Received webhook id=%s event=%s",
            webhook_payload.get("webhook_id"), webhook_payload.get("event_id"),
        )
    except json.JSONDecodeError as error:
        logger.warning("Invalid webhook JSON: %s", error)
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid JSON")

    event = webhook_payload.get("event", {})
    transaction_id = event.get("id")
    if not transaction_id:
        logger.info("No transaction ID in webhook, nothing to do")
        return {"message": "No transaction ID in webhook"}

    if event.get("state") != "waiting_for_approval":
        logger.info("Skipping transaction %s in state: %s", transaction_id, event.get("state"))
        return {"message": f"Skipping transaction in state: {event.get('state')}"}

    # The webhook body only triggers the flow — validate against the transaction as
    # the Fordefi API reports it right now, not the (possibly stale) event snapshot.
    try:
        transaction = fordefi_api.fetch_transaction(transaction_id)
    except FordefiAPIError as error:
        logger.error("Failed to fetch transaction %s: %s", transaction_id, error)
        raise HTTPException(status_code=HTTPStatus.SERVICE_UNAVAILABLE, detail="Failed to fetch transaction")

    current_state = transaction.get("state")
    if current_state != "waiting_for_approval":
        logger.info("Transaction %s already decided, current state: %s", transaction_id, current_state)
        return {"message": f"Transaction already decided, current state: {current_state}"}

    logger.info("Validating transaction %s", transaction_id)
    decoded_call, decode_error = decode_calldata(transaction.get("hex_data") or "")
    context = RuleContext(
        transaction=transaction,
        config=config,
        decoded_call=decoded_call,
        decode_error=decode_error,
    )
    result = run_rules(ALL_RULES, context)

    try:
        if result.verdict is Verdict.ABORT:
            fordefi_api.abort_transaction(transaction_id, result.reason)
            logger.info("Decision tx=%s decision=aborted reason=%s", transaction_id, result.reason)
            return {"decision": "aborted", "reason": result.reason}
        fordefi_api.approve_transaction(transaction_id)
        logger.info("Decision tx=%s decision=approved reason=%s", transaction_id, result.reason)
        return {"decision": "approved"}
    except FordefiAPIError as error:
        # Let Fordefi retry the webhook; the fresh-state check above makes retries safe.
        logger.error("Failed to submit decision for transaction %s: %s", transaction_id, error)
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=str(error))
