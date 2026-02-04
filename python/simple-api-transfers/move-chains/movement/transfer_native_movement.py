import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
from fordefi_protocol_types import TransactionType, SignerType, AptosTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def move_tx_native(vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.APTOS_TRANSACTION.value,
        "details": {
            "type": AptosTransactionDetailType.APTOS_TRANSFER.value,
            "to": {
                "type": "hex",
                "address": destination
            },
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": AssetIdentifierType.APTOS.value,
                "details": {
                    "type": AssetDetailType.NATIVE.value,
                    "chain": "aptos_movement_mainnet"
                }
            }
        },
        "note": custom_note,
        "vault_id": vault_id
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
APTOS_VAULT_ID = os.environ["APTOS_VAULT_ID"]
path = "/api/v1/transactions"
destination = "0x448692f73804b89ed750284286aaa023165539f3a20858eeb65622cab6224557" # CHANGE to your destination address
custom_note = "hello Movement!" # Optional note
value = str(100_000_000) # 1 MOVE

async def main():
    try:
        ## Building transaction
        request_json = await move_tx_native(vault_id=APTOS_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
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