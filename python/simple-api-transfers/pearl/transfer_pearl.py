import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_payload(vault_id: str, destination: str, value: str, note: str):
    request_json = {
        "to": {
            "type": "address",
            "address": destination
        },
        "amount": {
            "type": "value",
            "value": value
        },
        "asset_identifier": {
            "type": "utxo",
            "details": {
                "type": "native",
                "chain": "pearl_testnet"
            }
        },
        "note": note,
        "vault_id": vault_id
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
PEARL_VAULT_ID = os.environ["TESTNET_PEARL_VAULT_ID"]
path = "/api/v1/transactions/transfer" # https://docs.fordefi.com/api/latest/openapi/transactions/create_transfer_api_v1_transactions_transfer_post
destination = "tprl1..." # CHANGE to your Pearl testnet address
value = str(10000) # 0.00001 PRL = 10000 grains (1 PRL = 100,000,000 grains)
optional_note = "Pearl out!"

async def main():
    try:
        ## Building transaction
        request_json = await build_payload(vault_id=PEARL_VAULT_ID, destination=destination, value=value, note=optional_note)
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