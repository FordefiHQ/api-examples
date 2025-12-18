import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def sui_tx_native(vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "sui_transaction",
        "details": {
            "type": "sui_transfer",
            "to": {
                "type": "hex",
                "address": destination
            },
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": "sui",
                "details": {
                    "type": "native",
                    "chain":"sui_mainnet"
                }
            }
        },
        "note": custom_note,
        "vault_id": vault_id
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
SUI_VAULT_ID = os.environ["SUI_VAULT_ID"]
path = "/api/v1/transactions"
destination = "0x20f2b0d2fe3ca33deba567a660d156b500ef7711d50be36aef71e5216d460b82" # CHANGE to your destination address
custom_note = "hello Sui!" # Optional note
value = str(100) # 1 SUI = 1_000_000_000 Mists

async def main():
    try:
        ## Building transaction
        request_json = await sui_tx_native(vault_id=SUI_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
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