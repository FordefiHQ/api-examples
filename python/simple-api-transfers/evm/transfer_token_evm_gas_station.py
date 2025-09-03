import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def evm_tx_tokens(evm_chain: str, vault_id: str, destination: str, custom_note: str, value: str, token_contract: str, funder: str):
    print(f"Funder -> {funder}")
    request_json =  {
        "signer_type": "api_signer",
        "type": "evm_transaction",
        "details": {
            "funder": funder,
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
FUNDER_VAULT_ID = os.getenv("FUNDER_VAULT_ID")
evm_chain = "ethereum"
path = "/api/v1/transactions"
destination = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73" # CHANGE
custom_note = "hello!" # Optional note
token_contract_address = "0xdAC17F958D2ee523a2206206994597C13D831ec7" # USDT on Ethereum
value = str(1_000_000) # 1 USDT

async def main():
    try:
        ## Building transaction
        request_json = await evm_tx_tokens(evm_chain=evm_chain, 
                                           vault_id=EVM_VAULT_ID, 
                                           destination=destination, 
                                           custom_note=custom_note, 
                                           value=value, 
                                           token_contract=token_contract_address,
                                           funder=FUNDER_VAULT_ID)
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