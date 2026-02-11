import os
import json
import ecdsa
import base64
import hashlib
from pathlib import Path
from threading import Lock
from http import HTTPStatus
from dotenv import load_dotenv
from ecdsa.util import sigdecode_der
from datetime import datetime, timezone
from fastapi import FastAPI, Request, HTTPException

load_dotenv()

FORDEFI_API_USER_TOKEN = os.getenv("FORDEFI_API_USER_TOKEN")
public_key_path = Path("./public_key.pem")
with open(public_key_path, "r") as f:
    FORDEFI_PUBLIC_KEY = f.read()
signature_pub_key = ecdsa.VerifyingKey.from_pem(FORDEFI_PUBLIC_KEY)

app = FastAPI()

events_file_lock = Lock()
events_file_path = Path("./live-events/live_fordefi_events.json")

def log_fordefi_event_to_file(event_data: dict):
    with events_file_lock:
        events = []
        if events_file_path.exists():
            try:
                with open(events_file_path, "r") as f:
                    events = json.load(f)
            except json.JSONDecodeError:
                events = []
        events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event_data
        })
        with open(events_file_path, "w") as f:
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

@app.get("/health")
async def health_check():
    return {"status": "online"}

@app.post("/")
async def fordefi_webhook(request: Request):
    print(f"\n🌐 Client IP: {request.client.host}") # type: ignore
    print("\n📋 Incoming webhook headers:")
    for header_name, header_value in request.headers.items():
        print(f"  {header_name}: {header_value}")

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

    print("\n📝 Received event:")
    print(json.dumps(event_data, indent=2))

    # Log event to file (OPTIONAL)
    log_fordefi_event_to_file(event_data)
    print(f"✅ Event logged to {events_file_path}")

    return {"status": "ok"}

# uvicorn fordefi_webhooks:app --host 0.0.0.0 --port 8080 --reload