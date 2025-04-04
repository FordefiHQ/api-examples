import os
import ecdsa
import hashlib
import requests
import base64
import json
import datetime
from dotenv import load_dotenv
load_dotenv()


### FUNCTIONS

def broadcast_tx(path, access_token, signature, timestamp, request_body):

    try:
        resp_tx = requests.post(
            f"https://api.fordefi.com{path}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "x-signature": base64.b64encode(signature),
                "x-timestamp": timestamp.encode(),
            },
            data=request_body,
        )
        resp_tx.raise_for_status()
        return resp_tx

    except requests.exceptions.HTTPError as e:
        error_message = f"HTTP error occurred: {str(e)}"
        if resp_tx.text:
            try:
                error_detail = resp_tx.json()
                error_message += f"\nError details: {error_detail}"
            except json.JSONDecodeError:
                error_message += f"\nRaw response: {resp_tx.text}"
        raise RuntimeError(error_message)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error occurred: {str(e)}")


def sol_tx_native(vault_id, destination, custom_note, value):

    request_json = {

    "signer_type": "api_signer",
    "type": "solana_transaction",
    "details": {
        "type": "solana_transfer",
        "to": destination,
        "value": {
            "type": "value",
            "value": value
        },
        "asset_identifier": {
            "type": "solana",
            "details": {
                "type": "native",
                "chain": "solana_mainnet"
            }
        }
    },
    "note": custom_note,
    "vault_id": vault_id
    }
    
    return request_json

def sign(payload):

    ## LOCAL USE
    PRIVATE_KEY_FILE = "./secret/private.pem"
    with open(PRIVATE_KEY_FILE, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())

    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )

    return signature

### Core logic

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
SOL_VAULT_ID = os.getenv("SOL_VAULT_ID")
path = "/api/v1/transactions"
destination = "9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS" # CHANGE
custom_note = "hello!"
value = "100" # SOL in lamports

## Building transaction
request_json = sol_tx_native(vault_id=SOL_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
request_body = json.dumps(request_json)
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

## Signing transaction with API Signer (local)
signature = sign(payload=payload)

## Broadcasting tx
resp_tx = broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
print("✅ Transaction submitted successfully!")