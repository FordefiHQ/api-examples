import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_request(vault_id: str, destination: str, custom_note: str, jetton_master_raw_format_address: str, value: str):
    request_json = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": custom_note,
        "type": "ton_transaction",
        "details": {
            "push_mode": "manual",
            "type": "ton_transfer",
            "to":{
                "type": "hex",
                "address": destination
            },
            "asset_identifier": {
                "type": "ton",
                "details": {
                    "type": "jetton",
                    "jetton": {
                        "chain": "ton_mainnet",
                        "address": jetton_master_raw_format_address
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
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
TRON_VAULT_ID = os.environ["TON_VAULT_ID"]
path = "/api/v1/transactions"
destination = "UQApn3xK3wVS5vH2LXMga1sJNY5QrcTNjDPFlyt3yR2aipwt" # CHANGE to your TON destination address
custom_note = "hello TON!" # Optional note
value = str(100_000) #  0.1 USDT (1 USDT = 1_000_000)
jetton_master_raw_format_address = "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe" # USDT

async def main():
    try:
        ## Building transaction
        request_json = await build_request(vault_id=TRON_VAULT_ID, destination=destination, custom_note=custom_note, jetton_master_raw_format_address=jetton_master_raw_format_address, value=value)
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