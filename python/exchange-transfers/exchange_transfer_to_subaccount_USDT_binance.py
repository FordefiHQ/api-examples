import os
import json
import asyncio
import datetime
from utils.tx_builders import format_internal_transfer_token
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
BINANCE_EXCHANGE_VAULT_ID = os.environ["BINANCE_EXCHANGE_VAULT_ID"]
path = "/api/v1/transactions"
destination = os.environ["BINANCE_SUBACCOUNT_VAULT_ID"] # CHANGE to your subaccount vault_id
custom_note = "hello!"
value = str(1_000_000_000_000_000_000) # Amount represents 1 USDT (using 18-decimal precision required by Fordefi API, regardless of asset's native decimals)
exchange_name = "binance"
asset = "USDT"

async def main():
    ## Building transaction
    request_json = await format_internal_transfer_token(vault_id=BINANCE_EXCHANGE_VAULT_ID, destination=destination, custom_note=custom_note, value=value, exchange=exchange_name, asset=asset)
    request_body = json.dumps(request_json)
    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    payload = f"{path}|{timestamp}|{request_body}"
    ## Signing transaction with API User Private key
    signature = await sign(payload=payload)
    ## Broadcasting tx
    await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
    print("✅ Transaction submitted successfully!")

if __name__ == "__main__":
    asyncio.run(main())