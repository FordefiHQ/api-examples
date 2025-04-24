import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def evm_tx_tokens(evm_chain, vault_id, destination, custom_note, value, token_contract):


    request_json =  {
        "signer_type": "api_signer",
        "type": "evm_transaction",
        "details": {
            "type": "evm_transfer",
            "gas": {
            "type": "priority",
            "priority_level": "medium"
            },
            "to": destination,
            "value": {
            "type": "value",
            "value": value
            },
            "asset_identifier": {
                "type": "evm",
                "details": {
                    "type": "erc20",
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
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
EVM_VAULT_ID = os.getenv("EVM_VAULT_ID")
evm_chain = "bsc"
path = "/api/v1/transactions"
destination = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93" # CHANGE
custom_note = "hello!" # Optional note
token_contract_address = "0x55d398326f99059fF775485246999027B3197955" # USDT on Binance Smart Chain
value = str(100_000_0000_000_000_000) # 1 USDT

async def main():
    try:
        ## Building transaction
        request_json = await evm_tx_tokens(evm_chain=evm_chain, vault_id=EVM_VAULT_ID, destination=destination, 
                                          custom_note=custom_note, value=value, token_contract=token_contract_address)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"

        ## Signing transaction with API Signer
        signature = await sign(payload=payload)

        ## Broadcasting transaction
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())