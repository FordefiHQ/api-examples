import os
import json
import asyncio
import datetime
from utils.tx_builders import format_withdraw_native_ethereum
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
BINANCE_EXCHANGE_VAULT_ID = os.getenv("BINANCE_EXCHANGE_VAULT_ID")
path = "/api/v1/transactions"
destination = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73" # CHANGE to your destination address
custom_note = "hello!"
value = str(1_000_000_000_000_000_000) # Amount represents 1 ETH (using 18-decimal precision required by Fordefi API, regardless of asset's native decimals)
exchange_name = "binance"
asset = "ETH"

async def main():
    ## Building transaction
    request_json = await format_withdraw_native_ethereum(vault_id=BINANCE_EXCHANGE_VAULT_ID, destination=destination, custom_note=custom_note, value=value, exchange=exchange_name, asset=asset)
    request_body = json.dumps(request_json)
    timestamp = datetime.datetime.now().strftime("%s")
    payload = f"{path}|{timestamp}|{request_body}"
    ## Signing transaction with API User Private key
    signature = await sign(payload=payload)
    ## Broadcasting tx
    await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
    print("✅ Transaction submitted successfully!")

if __name__ == "__main__":
    asyncio.run(main())