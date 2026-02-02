import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def sol_tx_tokens(vault_id: str, destination: str, custom_note: str, value: str, token: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "solana_transaction",
        "details": {
            "fee": {
                "type": "custom",
                "unit_price": "100000000" # you can replace unit_price with priority_fee but NOT combine them
            },
            "type": "solana_transfer",
            "to": destination,
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": "solana",
                "details": {
                    "type": "spl_token",
                    "token": {
                        "chain": "solana_mainnet",
                        "base58_repr": token
                    }
                }
            }
        },
        "note": custom_note,
        "vault_id": vault_id
    }

    return request_json

## CONFIG
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
SOL_VAULT_ID = os.environ["SOL_VAULT_ID"]
path = "/api/v1/transactions"
destination = "9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS" # Change to your destination address
custom_note = "hello!" # Optional note
value = str(100)  # in smallest units (1 USDC = 1_000_000 SOL)
token_address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" # USDC on Solana

async def main():
    try:
        ## Building transaction
        request_json = await sol_tx_tokens(vault_id=SOL_VAULT_ID, destination=destination, 
                                    custom_note=custom_note, value=value, token=token_address)
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
