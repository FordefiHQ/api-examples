import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from fordefi_protocol_types import TransactionType, SignerType, GasType, GasDetailsType, EvmTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def evm_tx_native(evm_chain: str, vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "note": custom_note,
        "type": TransactionType.EVM_TRANSACTION.value,
        "details": {
            "type": EvmTransactionDetailType.EVM_TRANSFER.value,
            "gas": {
                "gas_limit": "1000000",
                "type": GasType.CUSTOM.value,
                "details": {
                    "type": GasDetailsType.LEGACY.value,
                    "price": "1000000000" # 1 GWEI
                }
            },
            "to": destination,
            "asset_identifier": {
                "type": AssetIdentifierType.EVM.value,
                "details": {
                    "type": AssetDetailType.NATIVE.value,
                    "chain": f"evm_{evm_chain}" # for custom evms, the chain must be declared as evm_chainId
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
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"]
evm_chain = "42793" # Etherlink chain
path = "/api/v1/transactions"
destination = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93" # CHANGE to your EVM address
custom_note = "hello!" # Optional note
value = str(10_000_000_000_000) # 0.00001 XTZ (1 XTZ = 0.000000000000000001 wei)

async def main():
    try:
        ## Building transaction
        request_json = await evm_tx_native(evm_chain=evm_chain, vault_id=EVM_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
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