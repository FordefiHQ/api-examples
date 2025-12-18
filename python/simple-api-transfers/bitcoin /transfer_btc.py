import os
import json
import asyncio
import datetime
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
                "chain": "bitcoin_mainnet"
            }
        },
        "note": note,
        "vault_id": vault_id
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
BTC_VAULT_ID = BTC_VAULT_ID = os.getenv("BTC_VAULT_ID")
path = "/api/v1/transactions/transfer" # https://docs.fordefi.com/api/latest/openapi/transactions/create_transfer_api_v1_transactions_transfer_post
destination = "bc1p4m94zze0tv9kp7usnpha7u98lpanemufhshgv9nae4c3myanc5csly8ayl" # CHANGE to your Bitcoin address
value = str(10000) # 0.00001 BTC = 10000 satoshis (1 BTC = 100,000,000 satoshis)
optional_note = "We're all Satoshi!"

async def main():
    try:
        ## Building transaction
        request_json = await build_payload(vault_id=BTC_VAULT_ID, destination=destination, value=value, note=optional_note)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
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