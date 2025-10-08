import os
import json
import asyncio
import datetime
from pathlib import Path
from broadcast import broadcast_tx
from sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
chain_type = "evm"
group_ids = ["82a840da-78ca-439d-b874-0fd7daf54fb4"] # OPTIONAL
chains = ["evm_ethereum_mainnet"] # OPTIONAL, remove argument for "All EVM"
contact_address = "0x888888888889758F76e7103c6CbF23ABbF58F946"
path = "/api/v1/addressbook/contacts/batch"

async def main():
    try:
        ## Building transaction payload
        request_json = {
            "contacts": [
                {
                "name": "Batcher Ethereum",
                "type": chain_type,
                "address": "0x7D8D7e776aC41c5F819965b2E288b2D03fe517aE",
                "chains":["evm_ethereum_mainnet"] # for CUSTOM evm chains use "evm_chainId", for example evm_747474
                },
                {
                "name": "Batcher Base",
                "type": chain_type,
                "address": "0x8D1A4e041A3080d9a4170e7606B5255c23298886",
                "chains":["evm_base_mainnet"]  
                }
                ]
            }
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"

        ## Signing transaction payload with API User's private key
        signature = await sign(payload=payload, private_key_path=PRIVATE_KEY_PEM_FILE)

        ## Broadcasting signed payload to Fordefi
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())