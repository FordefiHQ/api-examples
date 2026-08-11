import os
import json
import ecdsa
import base64
import hashlib
import hmac
import requests
from pathlib import Path
from threading import Lock
from http import HTTPStatus
from dotenv import load_dotenv
from ecdsa.util import sigdecode_der
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import Depends, FastAPI, Header, Query, Request, HTTPException

load_dotenv()

FORDEFI_API_USER_TOKEN = os.getenv("FORDEFI_API_USER_TOKEN")
FORDEFI_API_BASE_URL = "https://api.fordefi.com"
ALLOWED_IPS = {"54.243.103.88"}  # Fordefi's NAT IP
# Only trust X-Forwarded-For when a proxy you control overwrites it (ngrok, your load
# balancer). The header is client-supplied, so trusting it on a directly-reachable
# server lets anyone claim Fordefi's IP.
TRUST_PROXY_HEADER = os.getenv("TRUST_PROXY_HEADER", "false").strip().lower() in {
    "1", "true", "yes", "on"
}
# Shared secret for the admin routes below. They proxy FORDEFI_API_USER_TOKEN to the
# Fordefi API, so they must never be reachable by an unauthenticated caller. Unset means
# the routes refuse to serve rather than serve openly.
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN")
public_key_path = Path("./public_key.pem")
with open(public_key_path, "r") as f:
    FORDEFI_PUBLIC_KEY = f.read()
signature_pub_key = ecdsa.VerifyingKey.from_pem(FORDEFI_PUBLIC_KEY)

# Audit-log categories that should raise a security alert. The remaining
# categories (vaults, chains) are logged as informational.
SENSITIVE_CATEGORIES = {
    "policy",
    "quorum_threshold",
    "user_management",
    "user_group",
    "authentication",
    "aml_policy",
    "webhook",
    "backup",
    "device_backup",
    "import_keys",
    "address_book",
    "address_group",
    "vault_group",
    "dapp_group"
}

app = FastAPI()

events_file_lock = Lock()
alerts_file_path = Path("./live-events/audit_alerts.json")
events_file_path = Path("./live-events/audit_events.json")

def log_event_to_file(file_path: Path, event_data: dict):
    with events_file_lock:
        events = []
        if file_path.exists():
            try:
                with open(file_path, "r") as f:
                    events = json.load(f)
            except json.JSONDecodeError:
                events = []
        events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event_data
        })
        with open(file_path, "w") as f:
            json.dump(events, f, indent=2)

def verify_signature(signature: str, body: bytes) -> bool:
    try:
        return signature_pub_key.verify(
            signature=base64.b64decode(signature),
            data=body,
            hashfunc=hashlib.sha256,
            sigdecode=sigdecode_der,
        )
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False

def get_source_ip(request: Request) -> str:
    """Resolve the caller's IP, consulting X-Forwarded-For only when configured to.

    Requires uvicorn to run with --no-proxy-headers. Uvicorn's proxy-header middleware
    is on by default and rewrites request.client.host from X-Forwarded-For for any
    request arriving from 127.0.0.1, which would settle this before we are reached.
    """
    if TRUST_PROXY_HEADER:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def require_admin_token(x_admin_token: Optional[str] = Header(default=None)) -> None:
    """Gate the admin routes on a shared secret sent as X-Admin-Token.

    The webhook route authenticates callers by ECDSA signature, but these routes are
    called by you, not Fordefi, so there is no signature to check. They hand your API
    user's token to the Fordefi API on the caller's behalf — reading the organization's
    audit log and triggering webhook deliveries — so an open route here is an
    unauthenticated read of who did what in your organization.
    """
    if not ADMIN_API_TOKEN:
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            detail="Admin routes are disabled: set ADMIN_API_TOKEN to enable them",
        )
    if not x_admin_token or not hmac.compare_digest(
        x_admin_token.encode("utf-8"), ADMIN_API_TOKEN.encode("utf-8")
    ):
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Missing or invalid X-Admin-Token",
        )

def describe_actor(created_by: dict) -> str:
    if not isinstance(created_by, dict):
        return "unknown"
    return created_by.get("name") or created_by.get("email") or created_by.get("type") or "unknown"

@app.get("/health")
async def health_check():
    return {"status": "online"}

@app.post("/")
async def audit_log_webhook(request: Request):
    source_ip = get_source_ip(request)
    print(f"\n📡 Incoming webhook from IP: {source_ip}")

    if source_ip not in ALLOWED_IPS:
        print(f"⛔ Rejected request from unauthorized IP: {source_ip}")
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="Forbidden: IP not whitelisted"
        )

    signature = request.headers.get("X-Signature")

    if not signature:
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Missing signature"
        )

    raw_body = await request.body()

    if not verify_signature(signature, raw_body):
        print("Invalid signature")
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Invalid signature"
        )

    event_data = json.loads(raw_body.decode())
    audit_record = event_data.get("event", {})

    if not isinstance(audit_record, dict) or "category" not in audit_record:
        # Not an audit-log event (e.g. a transaction webhook pointed here)
        print(f"\n📝 Received non-audit event (event_type: {event_data.get('event_type')})")
        log_event_to_file(events_file_path, event_data)
        return {"status": "ok"}

    category = audit_record.get("category")
    if category in SENSITIVE_CATEGORIES:
        print(f"\n🚨 SECURITY ALERT — sensitive audit event")
        print(f"  Category:  {category}")
        print(f"  Action:    {audit_record.get('action')}")
        print(f"  Actor:     {describe_actor(audit_record.get('created_by'))}")
        print(f"  Client IP: {audit_record.get('client_ip')}")
        print(f"  Details:   {audit_record.get('description')}")
        log_event_to_file(alerts_file_path, event_data)
        print(f"✅ Alert logged to {alerts_file_path}")
    else:
        print(f"\n📝 Audit event: [{category}] {audit_record.get('description')}")
        log_event_to_file(events_file_path, event_data)
        print(f"✅ Event logged to {events_file_path}")

    return {"status": "ok"}

@app.get("/audit-logs", dependencies=[Depends(require_admin_token)])
async def list_audit_logs(
    page: Optional[int] = None,
    size: Optional[int] = None,
    category: Optional[List[str]] = Query(default=None),
    created_after: Optional[str] = None,
    created_before: Optional[str] = None,
):
    params = {
        "page": page,
        "size": size,
        "category": category,
        "created_after": created_after,
        "created_before": created_before,
    }
    params = {k: v for k, v in params.items() if v is not None}
    response = requests.get(
        f"{FORDEFI_API_BASE_URL}/api/v1/audit-log",
        headers={"Authorization": f"Bearer {FORDEFI_API_USER_TOKEN}"},
        params=params,
    )
    if not response.ok:
        # The upstream body stays in the log rather than going back to the caller.
        print(f"⚠️  Audit-log request failed ({response.status_code}): {response.text}")
        raise HTTPException(
            status_code=response.status_code, detail="Failed to list audit-log records"
        )
    return response.json()

@app.post("/replay/{record_id}", dependencies=[Depends(require_admin_token)])
async def replay_audit_log(record_id: str):
    response = requests.post(
        f"{FORDEFI_API_BASE_URL}/api/v1/webhooks/trigger/audit-log/{record_id}",
        headers={"Authorization": f"Bearer {FORDEFI_API_USER_TOKEN}"},
    )
    if not response.ok:
        print(f"⚠️  Replay request failed ({response.status_code}): {response.text}")
        raise HTTPException(
            status_code=response.status_code, detail="Failed to replay audit-log record"
        )
    return {"status": "replayed", "audit_log_id": record_id}

# uvicorn audit_logs_webhooks:app --host 127.0.0.1 --port 8080 --reload --no-proxy-headers
