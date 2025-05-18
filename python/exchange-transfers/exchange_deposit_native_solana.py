import os
import json
import asyncio
import datetime
from utils.tx_builders import format_deposit_native_sol
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
FORDEFI_SOLANA_VAULT_ID = os.getenv("FORDEFI_SOLANA_VAULT_ID")
BINANCE_EXCHANGE_VAULT_ID = os.getenv("BINANCE_EXCHANGE_VAULT_ID")
path = "/api/v1/transactions"
custom_note = "hello!"
value = str(10_000) # Amount represents 0.00001 SOL (using the native 9-decimal precision)

async def main():
    ## Building transaction payload
    request_json = await format_deposit_native_sol(vault_id=FORDEFI_SOLANA_VAULT_ID, destination=BINANCE_EXCHANGE_VAULT_ID, custom_note=custom_note, value=value)
    request_body = json.dumps(request_json)
    timestamp = datetime.datetime.now().strftime("%s")
    payload = f"{path}|{timestamp}|{request_body}"
    ## Signing transaction with API Signer (local)
    signature = await sign(payload=payload)
    ## Broadcasting tx
    await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
    print("✅ Transaction submitted successfully!")

if __name__ == "__main__":
    asyncio.run(main())