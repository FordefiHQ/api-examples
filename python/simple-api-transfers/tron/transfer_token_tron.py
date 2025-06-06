import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_request(vault_id: str, destination: str, custom_note: str, value: str, token_contract: str):
    request_json = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": custom_note,
        "type": "tron_transaction",
        "details": {
            "type": "tron_transfer",
            "to":{
                "type": "hex",
                "address": destination
            },
            "asset_identifier": {
                "type": "tron",
                "details": {
                    "type": "trc20",
                    "trc20":{
                        "chain": "tron_mainnet",
                        "base58_repr": token_contract
                    }
                }
            },
            "value": {
                "type": "value",
                "value": value
            }
        }
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
TRON_VAULT_ID = os.getenv("TRON_VAULT_ID")
evm_chain = "bsc"
path = "/api/v1/transactions"
destination = "THpczdekw3n93u48ZCbdpimcFVW8Rx9jrj" # CHANGE to your Tron destination address
custom_note = "hello Tron!" # Optional note
token_contract_address = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" # USDT on Tron
value = str(1_000_000) # 1 USDT

async def main():
    try:
        ## Building transaction
        request_json = await build_request(vault_id=TRON_VAULT_ID, destination=destination, custom_note=custom_note, value=value, token_contract=token_contract_address)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API Signer
        signature = await sign(payload=payload)
        ## Broadcasting tx
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())