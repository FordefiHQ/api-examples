import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_sponsored_tx(vault_id: str, destination: str, custom_note: str, value: str, fee_payer: str, token_contract: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "sui_transaction",
        "details": {
            "fee_payer": {
                "type": "vault",
                "vault_id": fee_payer
            },
            "type": "sui_transfer",
            "to": {
                "type": "hex",
                "address": destination
            },
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": "sui",
                "details": {
                    "type": "coin",
                    "coin_type":{
                        "chain": "sui_mainnet",
                        "coin_type_str": token_contract
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
SUI_VAULT_ID = os.environ["SUI_VAULT_ID"]
FEE_PAYER_VAULT_ID = os.environ["FEE_PAYER_VAULT_ID_SUI"]
path = "/api/v1/transactions"
destination = "0x20f2b0d2fe3ca33deba567a660d156b500ef7711d50be36aef71e5216d460b82" # CHANGE to your destination address
token_contract = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"
custom_note = "hello sponsored Sui transations!" # Optional note
value = str(100_000) # 1 USDC = 1_000_000

async def main():
    try:
        ## Building transaction
        request_json = await build_sponsored_tx(vault_id=SUI_VAULT_ID, destination=destination, custom_note=custom_note, value=value, fee_payer=FEE_PAYER_VAULT_ID, token_contract=token_contract)
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