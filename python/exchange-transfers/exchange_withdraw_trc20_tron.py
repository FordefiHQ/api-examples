import os
import json
import asyncio
import datetime
from utils.tx_builders import format_withdraw_trc20
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
BYBIT_EXCHANGE_VAULT_ID = os.getenv("BYBIT_EXCHANGE_VAULT_ID")
path = "/api/v1/transactions"
destination = "TEbpdRR6mefVBMUTLTFMBaGD7NxtywHpFD" # CHANGE to your destination address
custom_note = "hello!"
value = str(1_000_000_000_000_000_000) # Amount represents 1 USDT (using 18-decimal precision required by Fordefi API, regardless of asset's native decimals)
exchange_name = "bybit"
chain =  "tron"
asset = "USDT"

async def main():
    ## Building transaction
    request_json = await format_withdraw_trc20(vault_id=BYBIT_EXCHANGE_VAULT_ID, destination=destination, custom_note=custom_note, value=value, exchange=exchange_name, chain=chain, asset= asset)
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