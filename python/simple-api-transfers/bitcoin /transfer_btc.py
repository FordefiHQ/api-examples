import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def btc_tx_native(vault_id: str, destination: str, value: str):
    request_json = {
    "vault_id": vault_id,
    "signer_type": "api_signer",
    "type": "utxo_transaction",
    "details": {
            "type": "utxo_transfer",
            "outputs": [
                {
                    "to": {
                        "type": "address",
                        "address": destination
                    },
                    "value": value
                }
            ],
            "fee_per_byte": {
                "type": "priority",
                "priority_level": "high"
            }
        }
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
BTC_VAULT_ID = BTC_VAULT_ID = os.getenv("BTC_VAULT_ID")
path = "/api/v1/transactions" # CHANGE
destination = "bc1p4m94zze0tv9kp7usnpha7u98lpanemufhshgv9nae4c3myanc5csly8ayl" # CHANGE to your Bitcoin address
value = str(500) # 0.00001 BTC = 10000 satoshis (1 BTC = 100,000,000 satoshis)

async def main():
    try:
        ## Building transaction
        request_json = await btc_tx_native(vault_id=BTC_VAULT_ID, destination=destination, value=value)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API Signer
        signature = await sign(payload=payload)
        ## Broadcasting tx
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())