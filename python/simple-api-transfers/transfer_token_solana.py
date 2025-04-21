import os
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def sol_tx_tokens(vault_id, destination, custom_note, value, token):

    request_json = {
        "signer_type": "api_signer",
        "type": "solana_transaction",
        "details": {
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
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
SOL_VAULT_ID = os.getenv("SOL_VAULT_ID")
path = "/api/v1/transactions"
destination = "9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS" # Change to your destination address
custom_note = "hello!" # Optional note
value = str(1)  # in lamports (1 lamport = 0.000000001 SOL)
token_address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

async def main():
    try:
        ## Building transaction
        request_json = await sol_tx_tokens(vault_id=SOL_VAULT_ID, destination=destination, 
                                    custom_note=custom_note, value=value, token=token_address)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"

        ## Signing transaction with API Signer 
        signature = await sign(payload=payload)

        ## Broadcasting tx
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())