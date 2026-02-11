import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, AptosTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_sponsored_tx(vault_id: str, destination: str, custom_note: str, value: str, fee_payer: str, token_contract: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.APTOS_TRANSACTION.value,
        "details": {
            "fee_payer": {
                "type": "vault",
                "vault_id": fee_payer
            },
            "type": AptosTransactionDetailType.APTOS_TRANSFER.value,
            "to": {
                "type": "hex",
                "address": destination
            },
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": AssetIdentifierType.APTOS.value,
                "details": {
                    "type": AssetDetailType.NEW_COIN.value,
                    "new_coin_type":{
                        "chain": "aptos_mainnet",
                        "metadata_address": token_contract
                    }
                }
            }
        },
        "note": custom_note,
        "vault_id": vault_id
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
APTOS_VAULT_ID = os.environ["APTOS_VAULT_ID"]
FEE_PAYER_VAULT_ID = os.environ["FEE_PAYER_VAULT_ID_APTOS"]
path = "/api/v1/transactions"
destination = "0x125cdce37fe906619ffe12c4d411041f4de297c4b7667042a6fe3f3e1c9edcc6" # CHANGE to your destination address
token_contract = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
custom_note = "hello sponsored Sui transations!" # Optional note
value = str(10_000) # 1 USDC = 1_000_000

async def main():
    try:
        ## Building transaction
        request_json = await build_sponsored_tx(vault_id=APTOS_VAULT_ID, destination=destination, custom_note=custom_note, value=value, fee_payer=FEE_PAYER_VAULT_ID, token_contract=token_contract)
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