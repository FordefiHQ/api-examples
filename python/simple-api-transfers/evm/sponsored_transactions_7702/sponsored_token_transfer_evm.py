import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, GasType, GasPriorityLevel, EvmTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_sponsored_tx(evm_chain: str, vault_id: str, destination: str, value: str, token_contract: str, fee_payer: str):
    print(f"⛽ Fee payer: {fee_payer}")
    request_json =  {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EVM_TRANSACTION.value,
        "details": {
            "fee_payer": {
                "type": "vault",
                "vault_id": fee_payer
            },
            "type": EvmTransactionDetailType.EVM_TRANSFER.value,
            "gas": {
                "type": GasType.PRIORITY.value,
                "priority_level": GasPriorityLevel.MEDIUM.value
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
        "vault_id": vault_id
    }

    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"] # your upgraded smart account 
FEE_PAYER_VAULT_ID = os.environ["FEE_PAYER_VAULT_ID_EVM"] # the Fordefi vault that will pay the fee
evm_chain = "ethereum"
path = "/api/v1/transactions"
destination = "0xED8315fA2Ec4Dd0dA9870Bf8CD57eBf256A90772" # CHANGE
token_contract_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # USDC on Ethereum
value = str(100_000) # 0.1 USDT

async def main():
    try:
        ## Building transaction
        request_json = await build_sponsored_tx(evm_chain=evm_chain, 
                                           vault_id=EVM_VAULT_ID, 
                                           destination=destination,
                                           value=value, 
                                           token_contract=token_contract_address,
                                           fee_payer=FEE_PAYER_VAULT_ID)
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