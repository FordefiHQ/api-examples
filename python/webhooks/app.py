import os
import json
import ecdsa
import base64
import hashlib
from pathlib import Path 
from http import HTTPStatus
from dotenv import load_dotenv
from ecdsa.util import sigdecode_der
from fastapi import FastAPI, Request, HTTPException

load_dotenv()

FORDEFI_API_USER_TOKEN = os.getenv("FORDEFI_API_USER_TOKEN")
public_key_path = Path("./public_key.pem")
with open(public_key_path, "r") as f:
    FORDEFI_PUBLIC_KEY = f.read()
signature_pub_key = ecdsa.VerifyingKey.from_pem(FORDEFI_PUBLIC_KEY)

app = FastAPI()

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

@app.post("/")
async def fordefi_webhook(request: Request):
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

    print("\n📝 Received event:")
    print(json.dumps(json.loads(raw_body.decode()), indent=2))

    return {"status": "success"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "online"}

# uvicorn app:app --host 0.0.0.0 --port 8080 --reload