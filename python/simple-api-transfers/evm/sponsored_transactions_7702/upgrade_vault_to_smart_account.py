import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, GasType, GasPriorityLevel, EvmTransactionDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def upgrade_account_tx(evm_chain: str, vault_id: str):
    print(f"⬆️ Upgrading vault: {vault_id} on {evm_chain}")
    request_json =  {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EVM_TRANSACTION.value,
        "details": {
            "type": EvmTransactionDetailType.EVM_SET_CODE.value,
            "gas": {
            "gas_limit": "50000", # we need at least 46000 gas to clear the transaction
            "type": GasType.PRIORITY.value,
            "priority_level": GasPriorityLevel.MEDIUM.value
            },
            "chain": f"{evm_chain}_mainnet",
            "enable": True
        },
        "vault_id": vault_id
    }

    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"] ## Vault to upgrade to a smart account
evm_chain = "ethereum"
path = "/api/v1/transactions"

async def main():
    try:
        ## Building transaction
        request_json = await upgrade_account_tx(evm_chain=evm_chain, 
                                           vault_id=EVM_VAULT_ID)
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