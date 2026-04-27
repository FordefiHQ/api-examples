import os
import json
import asyncio
import datetime
import sys
from dotenv import load_dotenv
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from utils.sign_payload import sign
from utils.broadcast import broadcast_tx, get_tx
from fordefi_protocol_types import TransactionType, SignerType, GasType, GasDetailsType, EvmTransactionDetailType, AssetIdentifierType, AssetDetailType,TransactionState

load_dotenv()

async def evm_tx_tokens(evm_chain: str, vault_id: str, destination: str, custom_note: str, value: str, token_contract: str):
    request_json =  {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EVM_TRANSACTION.value,
        "details": {
            "type": EvmTransactionDetailType.EVM_TRANSFER.value,
            "gas": {
                    "gas_limit": "5000000",
                    "type": GasType.CUSTOM.value,
                    "details": {
                        "type": GasDetailsType.DYNAMIC.value,
                        "max_fee_per_gas": "20000000000", # 20 GWEI // Tempo uses a fixed base fee rather than the dynamic base fee mechanism specified in EIP-1559, see here: https://docs.tempo.xyz/protocol/fees/spec-fee#base-fee-model
                        "max_priority_fee_per_gas": "4000000000" # 4 GWEI
                }
            },
            "to": destination,
            "value": {
            "type": "value",
            "value": value
            },
            "asset_identifier": {
                "type": AssetIdentifierType.EVM.value,
                "details": {
                    "type": AssetDetailType.ERC20.value,
                    "token": {
                        "chain": f"evm_{evm_chain}_mainnet",
                        "hex_repr": token_contract
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
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"]
evm_chain = "tempo"
path = "/api/v1/transactions"
destination = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93" # CHANGE
custom_note = "hello!" # Optional note
token_contract_address = "0x20c000000000000000000000b9537d11c60e8b50" # Bridged USDC (Stargate) on Tempo
value = "100" # 1 USDC.e = 1_000_000

async def main():
    try:
        ## Building transaction
        request_json = await evm_tx_tokens(evm_chain=evm_chain, 
                                           vault_id=EVM_VAULT_ID, 
                                           destination=destination, 
                                           custom_note=custom_note, 
                                           value=value, 
                                           token_contract=token_contract_address)
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

            raw_transaction = tx_details.get("raw_transaction")
            if raw_transaction is None:
                print(f"  Status: {tx_state}...")

        print(f"Transaction signed and broadcast successfully!")
        print(f"Raw transaction: {raw_transaction}")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())