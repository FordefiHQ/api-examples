import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, CantonTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_request(vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "note": custom_note,
        "type": TransactionType.CANTON_TRANSACTION.value,
        "details": {
            "type": CantonTransactionDetailType.CANTON_TRANSFER.value,
            "to": {
                "type": "address",
                "address": destination
            },
            "asset_identifier": {
                "type": AssetIdentifierType.CANTON.value,
                "details": {
                    "type": AssetDetailType.NATIVE.value,
                    "chain": "canton_mainnet"
                }
            },
            "value": {
                "type": "value",
                "value": value
            }
        }
    }

    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
CANTON_VAULT_ID = os.environ["CANTON_VAULT_ID"]
path = "/api/v1/transactions"
destination = "a40499fb::1220658fa4bcb98af77d7afa36b681724903fc126609ea128eae69249aba235429b6" # CHANGE to recipient's Canton party id
custom_note = "hello Canton!" # Optional note
value = str(10_000_000_000) # 1 CC (Canton Coin has 10 decimals, 1 CC = 10_000_000_000 units)

async def main():
    try:
        ## Building transaction
        request_json = await build_request(vault_id=CANTON_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
        request_body = json.dumps(request_json)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API User private key
        signature = await sign(payload=payload)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        resp = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print(f"✅ Transaction submitted successfully! Transaction ID: {resp.json()['id']}")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
