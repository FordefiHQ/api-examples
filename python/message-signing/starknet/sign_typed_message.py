import os
import sys
import json
import base64
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.signer import sign_with_api_user_private_key
from shared.api_client import make_api_request
from starknet.construct_request import construct_typed_message_request

# Load Fordefi secrets
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
PRIVATE_KEY_PEM_FILE = Path(__file__).resolve().parent.parent / "secret" / "private.pem"
PATH = "/api/v1/transactions/create-and-wait"
FORDEFI_API_USER_TOKEN = os.environ["FORDEFI_API_USER_TOKEN"]
FORDEFI_STARKNET_VAULT_ID = os.environ["FORDEFI_STARKNET_VAULT_ID"]
# Starknet chain configuration: "starknet_mainnet" or "starknet_sepolia"
STARKNET_CHAIN = "starknet_mainnet"

# Example SNIP-12 typed data.
# Starknet's `typed_message_type` maps to the SNIP-12 standard.
typed_data = {
    "types": {
        "StarknetDomain": [
            {"name": "name", "type": "shortstring"},
            {"name": "version", "type": "shortstring"},
            {"name": "chainId", "type": "shortstring"},
            {"name": "revision", "type": "shortstring"}
        ],
        "Message": [
            {"name": "message", "type": "felt"}
        ]
    },
    "primaryType": "Message",
    "domain": {
        "name": "Fordefi Example",
        "version": "1",
        "chainId": "SN_MAIN",  # "SN_SEPOLIA" for testnet
        "revision": "1"
    },
    "message": {
        "message": "Hello from Fordefi!"
    }
}


def decode_signature(signature_b64):
    """Starknet signatures are an (r, s) pair over the Stark curve."""
    signature = base64.b64decode(signature_b64)
    r = int.from_bytes(signature[0:32], byteorder='big')
    s = int.from_bytes(signature[32:64], byteorder='big')
    return r, s


def main():
    request_json = construct_typed_message_request(FORDEFI_STARKNET_VAULT_ID, typed_data, STARKNET_CHAIN)
    request_body = json.dumps(request_json)

    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    payload = f"{PATH}|{timestamp}|{request_body}"
    signature = sign_with_api_user_private_key(payload=payload, api_user_private_key=PRIVATE_KEY_PEM_FILE)

    try:
        print("Making API request to Fordefi 📡")
        method = "post"
        response_data = make_api_request(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body, method=method)
        try:
            print("\nResponse Data:")
            print(json.dumps(response_data, indent=2))
            if response_data.get("has_timed_out") and response_data.get("state") == "waiting_for_approval":
                tx_id = response_data.get("id")
                print("\n⏳ Request timed out while waiting for approval.")
                print("   Note: The transaction is NOT cancelled - it can still be approved and signed.")
                print(f"   Transaction ID: {tx_id}")
                print(f"   Track status: GET /api/v1/transactions/{tx_id}")
                print("   Docs: https://docs.fordefi.com/api/latest/openapi/transactions/get_transaction_api_v1_transactions__id__get")
                return

            if "signatures" in response_data and response_data["signatures"]:
                signature_b64 = response_data["signatures"][0]
                signature_bytes = base64.b64decode(signature_b64)
                signature_hex = '0x' + signature_bytes.hex()

                print(f"\nSignature (hex): {signature_hex}")

                r, s = decode_signature(signature_b64)
                print(f"\nDecoded signature components:")
                print(f"r: {hex(r)}")
                print(f"s: {hex(s)}")

        except json.JSONDecodeError:
            print("Failed printing response data!")
    except requests.exceptions.HTTPError as e:
        error_message = f"HTTP error occurred: {str(e)}"
        if response_data.text:
            try:
                error_detail = response_data.json()
                error_message += f"\nError details: {error_detail}"
            except json.JSONDecodeError:
                error_message += f"\nRaw response: {response_data.text}"
        raise RuntimeError(error_message)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error occurred: {str(e)}")

    except Exception as e:
            print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
