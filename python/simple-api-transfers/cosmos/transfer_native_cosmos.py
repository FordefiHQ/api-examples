import os
import json
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from fordefi_protocol_types import TransactionType, SignerType, PushMode, SignMode, CosmosTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def atom_tx_native(vault_id: str, chain: str, destination: str, amount: str, memo: str):
    request_json = {
    "vault_id": vault_id,
    "signer_type": SignerType.API_SIGNER.value,
    "sign_mode": SignMode.AUTO.value,
    "type": TransactionType.COSMOS_TRANSACTION.value,
    "details": {
      "type": CosmosTransactionDetailType.COSMOS_TRANSFER.value,
      "push_mode": PushMode.AUTO.value,
      "to": {
          "type": "address",
          "address": {
            "chain": chain,
            "address": destination,
          }
      },
      "asset_identifier":{
        "type": AssetIdentifierType.COSMOS.value,
        "details": {
            "type": AssetDetailType.NATIVE.value,
            "chain": chain,
        },
      },
      "value": {
          "type": "value",
          "value": amount
      },
      "memo": memo
    }
  }
    
    return request_json

## Fordefi configuration
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
COSMOS_VAULT_ID = os.environ["COSMOS_VAULT_ID"]
path = "/api/v1/transactions"
chain="cosmos_cosmoshub-4"
destination = "cosmos1c8296f7cq4nvwjfvjq2x2jmrxnmw7wjyscxamy" # CHANGE to your destination address
memo = "1234" # Optional memo
amount = str(100) # 1 ATOM = 1_000_000 uatom

async def main():
    try:
        ## Building transaction
        request_json = await atom_tx_native(vault_id=COSMOS_VAULT_ID, chain=chain, destination=destination, amount=amount, memo=memo)
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