import os
import json
import asyncio
import datetime
from utils.tx_builders import format_ex_to_ex_withdrawal_token_evm
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
COINBASE_EXCHANGE_VAULT_ID = os.getenv("COINBASE_EXCHANGE_VAULT_ID")
BINANCE_EXCHANGE_VAULT_ID = os.getenv("BINANCE_EXCHANGE_VAULT_ID")
path = "/api/v1/transactions"
custom_note = "hello!"
value = str(1_000_000_000_000_000_000)# Amount represents 1 USDC (using 18-decimal precision required by Fordefi API, regardless of asset's native decimals)
origin_exchange_name = "coinbase_international"
asset = "USDC"

async def main():
    ## Building transaction
    request_json = await format_ex_to_ex_withdrawal_token_evm(vault_id=COINBASE_EXCHANGE_VAULT_ID, destination=BINANCE_EXCHANGE_VAULT_ID, custom_note=custom_note, value=value, origin_exchange=origin_exchange_name, asset=asset)
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