import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def evm_tx_tokens(evm_chain: str, vault_id: str, destination: str, custom_note: str, value: str, token_contract: str):
    request_json =  {
        "signer_type": "api_signer",
        "type": "evm_transaction",
        "details": {
            "type": "evm_transfer",
            "gas": {
                    "gas_limit": "50000",
                    "type": "custom",
                    "details": {
                        "type": "dynamic",
                        "max_fee_per_gas": "1000", 
                        "max_priority_fee_per_gas": "1000" # per EIP-1559: max_fee_per_gas >= max_priority_fee_per_gas
                }
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
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"]
evm_chain = "ethereum"
path = "/api/v1/transactions"
destination = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93" # CHANGE
custom_note = "hello!" # Optional note
token_contract_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # USDT on Ethereum mainnet
value = "10" # 1 USDT = 1_000_000

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
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())