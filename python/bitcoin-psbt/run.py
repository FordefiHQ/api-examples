import os
import json
import asyncio
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv
from broadcast import broadcast_tx
from construct_api_request import build_psbt_request
from sign_payload import sign_wih_api_user_private_key
from custom_rpc import poll_for_signed_tx, broadcast_via_custom_rpc

load_dotenv()
FORDEFI_API_USER_TOKEN = os.environ["FORDEFI_API_USER_TOKEN"]
PATH = "/api/v1/transactions"
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
psbt_hex_data = os.environ["PSBT_HEX_DATA"]
vault_id = os.environ["FORDEFI_BTC_VAULT_ID_TESTNET_V4"]
sender_address = os.environ["BTC_SENDER_ADDRESS_TESTNET_V4"]
will_auto_finalize = True
is_bitcoin_mainnet = False
uses_custom_rpc = False

# Optional: Custom RPC for self-broadcasting
# URL: e.g., https://blockstream.info/testnet/api/tx OR https://blockstream.info/api/tx
# Format: "rest" (Blockstream/Mempool), "jsonrpc" (Bitcoin Core), "blockcypher"
CUSTOM_RPC_URL = os.environ.get("CUSTOM_RPC_URL")
CUSTOM_RPC_FORMAT = os.environ.get("CUSTOM_RPC_FORMAT", "rest")


async def main():
    request_json = await build_psbt_request(vault_id, sender_address, psbt_hex_data, will_auto_finalize, uses_custom_rpc)

    request_body = json.dumps(request_json)
    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    payload = f"{PATH}|{timestamp}|{request_body}"
    signature = await sign_wih_api_user_private_key(payload, PRIVATE_KEY_PEM_FILE)
    try:
        print("Making API request to Fordefi for MPC signature 📡")
        resp_tx = await broadcast_tx(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body)
        print("Request ID: ", resp_tx.headers['x-request-id'])
        resp_tx.raise_for_status()

        if uses_custom_rpc and CUSTOM_RPC_URL:
            tx_data = resp_tx.json()
            tx_id = tx_data.get("id")
            if not tx_id:
                raise RuntimeError("Transaction ID not found in response")

            print(f"Custom RPC mode enabled. Transaction ID: {tx_id}")

            raw_signed_tx = await poll_for_signed_tx(
                tx_id, FORDEFI_API_USER_TOKEN, PRIVATE_KEY_PEM_FILE
            )

            txid = broadcast_via_custom_rpc(raw_signed_tx, CUSTOM_RPC_URL, CUSTOM_RPC_FORMAT)
            print(f"\nTransaction successfully broadcast via custom RPC!")
            print(f"TXID: {txid}")

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