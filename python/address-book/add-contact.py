import os
import json
import asyncio
import datetime
from pathlib import Path
from broadcast import broadcast_tx
from sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def prepare_payload():
    request_json = {
        "name": name,
        "group_ids": [
        "82a840da-78ca-439d-b874-0fd7daf54fb4"
        ],
        "type": chain_type,
        "address": contact_address,
        "chains": [
        evm_chain
        ]
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
EVM_VAULT_ID = os.getenv("EVM_VAULT_ID")
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
name = "Pendle router"
chain_type = "evm"
evm_chain = "evm_ethereum_mainnet"
contact_address = "0x888888888889758F76e7103c6CbF23ABbF58F946"
path = "/api/v1/addressbook/contacts"

async def main():
    try:
        ## Building transaction
        request_json = await prepare_payload()
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API Signer
        signature = await sign(payload=payload, private_key_path=PRIVATE_KEY_PEM_FILE)
        ## Broadcasting tx
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())