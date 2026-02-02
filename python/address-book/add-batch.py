import os
import json
import asyncio
import datetime
from pathlib import Path
from broadcast import broadcast_tx
from sign_payload import sign_with_api_user_private_key
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
path = "/api/v1/addressbook/contacts/batch"

async def main():
    try:
        ## Construct batch
        request_json = {
            "contacts": [
                {
                    "name": "My Ethereum Contact",
                    "type": "evm",
                    "address": "0x7D8D7e776aC41c5F819965b2E288b2D03fe517aE",
                    "chains":["evm_ethereum_mainnet"]  # for CUSTOM evm chains use "evm_chainId", for example evm_747474
                },
                {
                    "name": "My Base Contact",
                    "type": "evm",
                    "address": "0x8D1A4e041A3080d9a4170e7606B5255c23298886",
                    "chains":["evm_base_mainnet"]  
                },
                {
                    "name": "My Cross-Chain Contact",
                    "type": "evm",
                    "address": "0x0000000000000000000000000000000000000001",
                    # Remove "chain" to add the contact on "Any EVM"
                }
                ]
            }
        request_body = json.dumps(request_json)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{request_body}"

        ## Sign batch payload with API User's private key
        signature = await sign_with_api_user_private_key(payload=payload, private_key_path=PRIVATE_KEY_PEM_FILE)

        ## Send signed payload to Fordefi
        print("Making API request to Fordefi 📡")
        res = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("Request ID: ", res.headers['x-request-id'])
        print("✅ Batch submitted successfully!")

    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())