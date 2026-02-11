import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, TronTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_request(vault_id: str, destination: str, custom_note: str, value: str, token_contract: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "note": custom_note,
        "type": TransactionType.TRON_TRANSACTION.value,
        "details": {
            "type": TronTransactionDetailType.TRON_TRANSFER.value,
            "to":{
                "type": "hex",
                "address": destination
            },
            "asset_identifier": {
                "type": AssetIdentifierType.TRON.value,
                "details": {
                    "type": AssetDetailType.TRC20.value,
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
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
TRON_VAULT_ID = os.environ["TRON_VAULT_ID"]
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