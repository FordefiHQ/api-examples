import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def buildRequest(vault_id: str, destination: str, custom_note: str, value: str, exchange: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "exchange_transaction",
        "details": {
            "asset_identifier": {
                "asset_symbol": "USDC",
                "exchange_type": exchange,
                "type": "exchange"
            },
            "chain": "evm_ethereum_mainnet",
            "to": {
                "address": destination,
                "type": "address"
            },
            "type": "external_withdraw",
            "value": {
                "is_net_amount": True,
                "type": "value",
                "value": value
            }
        },
        "vault_id": vault_id,
        "note": custom_note
    }
    
    return request_json

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
COINBASE_EXCHANGE_VAULT_ID = os.getenv("COINBASE_EXCHANGE_VAULT_ID")
path = "/api/v1/transactions"
destination = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73" # CHANGE to your destination address
custom_note = "hello!"
value = str(1_000_000_000_000_000_000) # Amount represents 1 USDC (using 18-decimal precision required by Fordefi API, regardless of asset's native decimals)
exchange_name = "coinbase_international"

async def main():
    ## Building transaction
    request_json = await buildRequest(vault_id=COINBASE_EXCHANGE_VAULT_ID, destination=destination, custom_note=custom_note, value=value, exchange=exchange_name)
    request_body = json.dumps(request_json)
    timestamp = datetime.datetime.now().strftime("%s")
    payload = f"{path}|{timestamp}|{request_body}"
    ## Signing transaction payload with API Signer
    signature = await sign(payload=payload)
    ## Broadcasting tx
    await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
    print("✅ Transaction submitted successfully!")

if __name__ == "__main__":
    asyncio.run(main())