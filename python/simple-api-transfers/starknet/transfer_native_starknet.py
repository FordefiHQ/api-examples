import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, StarknetTransactionDetailType, AssetIdentifierType, AssetDetailType, TransactionState, GasType, GasPriorityLevel
from utils.broadcast import broadcast_tx, get_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def strk_tx_native(chain: str, vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "note": custom_note,
        "type": TransactionType.STARKNET_TRANSACTION.value,
        "details": {
            "type": StarknetTransactionDetailType.STARKNET_TRANSFER.value,
            "to": {
                "type": "hex",
                "address": destination
            },
            "asset_identifier": {
                "type": AssetIdentifierType.STARKNET.value,
                "details": {
                    "type": AssetDetailType.NATIVE.value,
                    "chain": chain
                }
            },
            "value": {
                "type": "value",
                "value": value
            },
            "gas": {
                "type": GasType.PRIORITY.value,
                "priority_level": GasPriorityLevel.MEDIUM.value
            },
        }
    }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
STARKNET_VAULT_ID = os.environ["STARKNET_VAULT_ID"]
chain = "starknet_mainnet"
path = "/api/v1/transactions"
destination = os.environ["DEFAULT_DESTINATION_ADDRESS_STARKNET"] # CHANGE to your Starknet address
custom_note = "hello Starknet!" # Optional note
value = str(1_000) # 0.000000000000001 STRK (1 STRK = 0.000000000000000001 fri)

async def main():
    try:
        ## Building transaction
        request_json = await strk_tx_native(chain=chain, vault_id=STARKNET_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
        request_body = json.dumps(request_json)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API User private key
        signature = await sign(payload=payload)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        ok = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        tx_data = ok.json()
        tx_id = tx_data.get("id")
        print(f"Transaction submitted successfully!")
        print(f"Transaction ID: {tx_id}")

        ## Poll for raw_transaction to be available
        print("Waiting for transaction to be signed...")
        raw_transaction = None
        while raw_transaction is None:
            await asyncio.sleep(2)
            tx_response = await get_tx(tx_id, USER_API_TOKEN, signature, timestamp)
            tx_details = tx_response.json()
            tx_state = tx_details.get("state", "unknown")

            if tx_state == TransactionState.ABORTED.value:
                print(f"Transaction was aborted!")
                return
            
            if tx_state == TransactionState.COMPLETED.value:
                print(f"Transaction completed succesfully!")
                return

            raw_transaction = tx_details.get("raw_transaction")
            if raw_transaction is None:
                print(f"  Status: {tx_state}...")

        print(f"Transaction signed and broadcast successfully!")
        print(f"Raw transaction: {raw_transaction}")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())