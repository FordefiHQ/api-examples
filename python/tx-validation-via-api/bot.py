import json
from http import HTTPStatus
from fastapi import FastAPI, Request, HTTPException
from fordefi import Config, FordefiAPI, SignatureVerifier, TransactionValidator, TransactionAbortError

config = Config()
fordefi_api = FordefiAPI(Config.FORDEFI_API_BASE_URL, config.validator_token)
signature_verifier = SignatureVerifier(config.fordefi_public_key)
transaction_validator = TransactionValidator(config.origin_vault, Config.ZERO_ADDRESS)

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "online"}


@app.post("/")
async def handle_webhook(request: Request):
    signature = request.headers.get("X-Signature")
    if not signature:
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Missing signature")

    raw_body = await request.body()
    if not signature_verifier.is_valid_signature(signature, raw_body):
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Invalid signature")

    try:
        webhook_payload = json.loads(raw_body)
        print(f"Received webhook: {webhook_payload['webhook_id']}, event: {webhook_payload['event_id']}")
    except json.JSONDecodeError as error:
        print(f"Invalid webhook JSON: {error}")
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid JSON")

    transaction_data = webhook_payload.get("event", {})
    transaction_id = transaction_data.get("id")

    if not transaction_id:
        return {"message": "No transaction ID in webhook"}

    transaction_state = transaction_data.get("state")
    print(f"Processing transaction {transaction_id} in state: {transaction_state}")

    if transaction_state != "waiting_for_approval":
        if transaction_state in Config.TERMINAL_TRANSACTION_STATES:
            return {"message": f"Transaction already in terminal state: {transaction_state}"}
        return {"message": f"Skipping transaction in state: {transaction_state}"}

    try:
        transaction_validator.validate(transaction_data)
        fordefi_api.approve_transaction(transaction_id)
        return {"message": "Transaction validated and approved"}

    except TransactionAbortError as validation_error:
        print(f"Validation failed: {validation_error}")
        fordefi_api.abort_transaction(transaction_id, str(validation_error))
        return {"message": f"Transaction aborted: {validation_error}"}

    except Exception as unexpected_error:
        print(f"Unexpected error: {unexpected_error}")
        try:
            fordefi_api.abort_transaction(transaction_id, f"Unexpected error: {unexpected_error}")
        except Exception as abort_error:
            print(f"Failed to abort after error: {abort_error}")
        return {"message": f"Transaction failed with unexpected error: {unexpected_error}"}
