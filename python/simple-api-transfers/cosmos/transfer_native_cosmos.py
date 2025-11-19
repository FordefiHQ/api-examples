import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def atom_tx_native(vault_id: str, chain: str, destination: str, amount: str, memo: str):
    request_json = {
    "vault_id": vault_id,
    "signer_type": "api_signer",
    "sign_mode": "auto",
    "type": "cosmos_transaction",
    "details": {
      "type": "cosmos_transfer",
      "push_mode": "auto",
      "to": {
          "type": "address",
          "address": {
            "chain": chain,
            "address": destination,
          }
      },
      "asset_identifier":{
        "type": "cosmos",
        "details": {
            "type": "native",
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
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
COSMOS_VAULT_ID = os.getenv("COSMOS_VAULT_ID")
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