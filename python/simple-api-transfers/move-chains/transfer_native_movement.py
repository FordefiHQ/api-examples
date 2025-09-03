import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def move_tx_native(vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "aptos_transaction",
        "details": {
            "type": "aptos_transfer",
            "to": {
                "type": "hex",
                "address": destination
            },
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": "aptos",
                "details": {
                    "type": "native",
                    "chain": "aptos_movement_mainnet"
                }
            }
        },
        "note": custom_note,
        "vault_id": vault_id
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
APTOS_VAULT_ID = os.getenv("APTOS_VAULT_ID")
path = "/api/v1/transactions"
destination = "0x448692f73804b89ed750284286aaa023165539f3a20858eeb65622cab6224557" # CHANGE to your destination address
custom_note = "hello Movement!" # Optional note
value = str(100_000_000) # 1 MOVE

async def main():
    try:
        ## Building transaction
        request_json = await move_tx_native(vault_id=APTOS_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"
         ## Signing transaction with API User private key
        signature = await sign(payload=payload)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())