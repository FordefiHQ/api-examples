import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, AptosTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def apt_tx_native(vault_id: str, destination: str, custom_note: str, value: str):
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
                    "chain": "aptos_mainnet"
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
destination = "0x...." # CHANGE to your destination address
custom_note = "hello Aptos!" # Optional note
value = str(10_000_000) # in octas, 10_000_000 = 0.1 APT

async def main():
    try:
        ## Building transaction
        request_json = await apt_tx_native(vault_id=APTOS_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
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