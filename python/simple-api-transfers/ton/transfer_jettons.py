import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from fordefi_protocol_types import TransactionType, SignerType, PushMode, TonTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_request(vault_id: str, destination: str, custom_note: str, jetton_master_raw_format_address: str, value: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "note": custom_note,
        "type": TransactionType.TON_TRANSACTION.value,
        "details": {
            "push_mode": PushMode.MANUAL.value,
            "type": TonTransactionDetailType.TON_TRANSFER.value,
            "to":{
                "type": "hex",
                "address": destination
            },
            "asset_identifier": {
                "type": AssetIdentifierType.TON.value,
                "details": {
                    "type": AssetDetailType.JETTON.value,
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
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
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