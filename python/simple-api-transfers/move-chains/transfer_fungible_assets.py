import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def apt_tx_native(vault_id: str, destination: str, custom_note: str, value: str, metadata_address: str):
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
                    "type": "new_coin",
                    "new_coin_type": {
                        "chain": "aptos_mainnet",
                        "metadata_address": metadata_address

                    }
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
destination = "0x" # CHANGE to your destination address
custom_note = "hello Aptos!" # Optional note
value = str(10) # in smallest units, 100_000_000 = 1 WBTC
metadata_address= "0x68844a0d7f2587e726ad0579f3d640865bb4162c08a4589eeda3f9689ec52a3d" # WBTC - Fungible Asset

async def main():
    try:
        ## Building transaction
        request_json = await apt_tx_native(vault_id=APTOS_VAULT_ID, destination=destination, custom_note=custom_note, value=value, metadata_address=metadata_address)
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