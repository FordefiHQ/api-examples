import os
import json
import asyncio
import datetime
from web3 import Web3
from pathlib import Path
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def contract_call(evm_chain: str, vault_id: str, contract: str, custom_note: str, value: str, call_data: str):
    request_json = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": custom_note,
        "type": "evm_transaction",
        "details": {
            "type": "evm_raw_transaction",
            "chain": f"evm_{evm_chain}_mainnet",
            "gas": {
                "type": "priority",
                "priority_level": "medium"
            },
            "to": contract,
            "value":value,
            "data": {
                "type": "hex",
                "hex_data": call_data
            },
        }
    }
    
    return request_json

## Fordefi configuration
API_USER_PRIVATE_KEY = Path("./secret/private.pem")
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
EVM_VAULT_ID = os.getenv("EVM_VAULT_ID")
evm_chain = "ethereum"
path = "/api/v1/transactions" # CHANGE
contract = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
custom_note = "It's a wrap!" # Optional note
value = str(Web3.to_wei(0.001, 'ether'))  # Returns 1000000000000000
hex_call_data = "0xd0e30db0"

async def main():
    try:
        ## Building transaction
        request_json = await contract_call(evm_chain=evm_chain, vault_id=EVM_VAULT_ID, contract=contract, custom_note=custom_note, value=value, call_data=hex_call_data)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API User private key
        signature = await sign(payload=payload, api_user_private_key=API_USER_PRIVATE_KEY)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())