import os
import json
import asyncio
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv
from broadcast import broadcast_tx
from construct_api_request import build_request
from sign_payload import sign_wih_api_user_private_key

load_dotenv()
FORDEFI_API_USER_TOKEN = os.getenv("FORDEFI_API_USER_TOKEN")
FORDEFI_BTC_VAULT_ID = os.getenv("FORDEFI_BTC_VAULT_ID")
FORDEFI_BTC_VAULT_TAPROOT_ADDRESS = os.getenv("FORDEFI_BTC_VAULT_TAPROOT_ADDRESS")
FORDEFI_BTC_VAULT_SEGWIT_ADDRESS = os.getenv("FORDEFI_BTC_VAULT_SEGWIT_ADDRESS")
PATH = "/api/v1/transactions"
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
will_auto_finalize = True
is_bitcoin_mainnet = True

async def main():
    psbt_hex_data = os.getenv("PSBT_HEX_DATA")
    request_json = await build_request(FORDEFI_BTC_VAULT_ID, FORDEFI_BTC_VAULT_TAPROOT_ADDRESS, psbt_hex_data, will_auto_finalize, is_bitcoin_mainnet)

    request_body = json.dumps(request_json)
    timestamp = datetime.datetime.now().strftime("%s")
    payload = f"{PATH}|{timestamp}|{request_body}"
        
    signature = await sign_wih_api_user_private_key(payload, PRIVATE_KEY_PEM_FILE)

    try: 
        print("Making API request to Fordefi for MPC signature 📡")
        resp_tx = await broadcast_tx(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body)
        print("Request ID: ", resp_tx.headers['x-request-id'])
        resp_tx.raise_for_status()
        return resp_tx
    except requests.exceptions.HTTPError as e:
        error_message = f"HTTP error occurred: {str(e)}"
        if resp_tx.text:
            try:
                error_detail = resp_tx.json()
                error_message += f"\nError details: {error_detail}"
            except json.JSONDecodeError:
                error_message += f"\nRaw response: {resp_tx.text}"
        raise RuntimeError(error_message)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error occurred: {str(e)}")

    except Exception as e:
            print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())