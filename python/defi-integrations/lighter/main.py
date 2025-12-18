import os
import json
import asyncio
import datetime
from pathlib import Path
from utils.sign_payload import sign
from utils.broadcast import broadcast_tx
from tx_builder import build_tx
from dotenv import load_dotenv

load_dotenv()

## Fordefi configuration
API_USER_PRIVATE_KEY = Path("./secret/private.pem")
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
EVM_VAULT_ID = os.getenv("EVM_VAULT_ID")
evm_chain = "ethereum"
path = "/api/v1/transactions" # CHANGE

async def main():
    try:
        print(await build_tx())
        # ## Building transaction
        # request_json = await build_tx()
        # request_body = json.dumps(request_json)
        # timestamp = datetime.datetime.now().strftime("%s")
        # payload = f"{path}|{timestamp}|{request_body}"
        # ## Signing transaction with API User private key
        # signature = await sign(payload=payload, api_user_private_key=API_USER_PRIVATE_KEY)
        # ## Push tx to Fordefi for MPC signing and broadcast to network
        # ok = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        # tx_data = ok.json()
        # tx_id = tx_data.get("id")
        # print(f"Transaction submitted successfully! ✅")
        # print(f"Transaction ID: {tx_id}")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
