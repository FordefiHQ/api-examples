import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, CantonTransactionDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_request(vault_id: str, custom_note: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "note": custom_note,
        "type": TransactionType.CANTON_TRANSACTION.value,
        "details": {
            "type": CantonTransactionDetailType.CANTON_PARTY_ALLOCATION.value,
            "chain": "canton_mainnet"
        }
    }

    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
CANTON_VAULT_ID = os.environ["CANTON_VAULT_ID"]
path = "/api/v1/transactions"
custom_note = "Activating Canton vault" # Optional note

async def main():
    try:
        ## Building party allocation transaction (registers the vault's external party on the Canton node)
        request_json = await build_request(vault_id=CANTON_VAULT_ID, custom_note=custom_note)
        request_body = json.dumps(request_json)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API User private key
        signature = await sign(payload=payload)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        resp = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print(f"✅ Party allocation submitted successfully! Transaction ID: {resp.json()['id']}")
    except Exception as e:
        print(f"❌ Party allocation failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
