import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, PushMode, StellarTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_request(vault_id: str, destination: str, value: str, custom_note: str):
    request_json = {
        "vault_id": vault_id,
        "signer_type": SignerType.API_SIGNER.value,
        "note": custom_note,
        "type": TransactionType.STELLAR_TRANSACTION.value,
        "details": {
            "type": StellarTransactionDetailType.STELLAR_TRANSFER.value,
            "push_mode": PushMode.AUTO.value,
            "to": {
                "type": "address",
                "address": destination
            },
            "asset_identifier": {
                "type": AssetIdentifierType.STELLAR.value,
                "details": {
                    "type": AssetDetailType.NATIVE.value,
                    "chain": "stellar_mainnet"
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
STELLAR_VAULT_ID = os.environ["STELLAR_VAULT_ID"]
path = "/api/v1/transactions"
destination = "G....." # CHANGE to your Stellar destination address (56-char G...)
custom_note = "hello Stellar!" # Optional note
value = str(10_000_000) # 1 XLM = 10_000_000 stroops (7 decimals)

async def main():
    try:
        ## Building transaction
        request_json = await build_request(vault_id=STELLAR_VAULT_ID, destination=destination, value=value, custom_note=custom_note)
        request_body = json.dumps(request_json)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API User private key
        signature = await sign(payload=payload)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
