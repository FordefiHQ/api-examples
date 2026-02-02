import os
import json
import base64
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv
from eth_account import Account
from eth_account.messages import encode_defunct
from signing.signer import sign_with_api_user_private_key
from request_builder.push_to_api import make_api_request
from request_builder.construct_request import construct_personal_message_request

# Load Fordefi config
load_dotenv()
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
PATH = "/api/v1/transactions/create-and-wait"
FORDEFI_API_USER_TOKEN = os.environ["FORDEFI_API_USER_TOKEN"]
FORDEFI_EVM_VAULT_ID = os.environ["FORDEFI_EVM_VAULT_ID"]
# EVM chain configuration
# Examples: "evm_1" (Ethereum), "evm_137" (Polygon), "evm_42161" (Arbitrum)
EVM_CHAIN = os.environ["EVM_CHAIN"]

# Example message - replace with your actual message
MESSAGE = """Hello, this is a test message to sign.

You can put any content here that you want to sign with your Fordefi EVM wallet."""


def decode_signature(signature_b64: str) -> tuple:
    signature_bytes = base64.b64decode(signature_b64)
    r = int.from_bytes(signature_bytes[0:32], byteorder='big')
    s = int.from_bytes(signature_bytes[32:64], byteorder='big')
    v = int(signature_bytes[64])
    return r, s, v

def ecrecover(message: str, signature_hex: str) -> str:
    signable_message = encode_defunct(text=message)
    recovered_address = Account.recover_message(signable_message, signature=signature_hex)
    return recovered_address

def main():
    print(f"Message to sign:\n{MESSAGE}\n")
    print("-" * 50)

    request_json = construct_personal_message_request(FORDEFI_EVM_VAULT_ID, MESSAGE, EVM_CHAIN)
    request_body = json.dumps(request_json)

    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    payload = f"{PATH}|{timestamp}|{request_body}"

    signature = sign_with_api_user_private_key(payload=payload, api_user_private_key=PRIVATE_KEY_PEM_FILE)

    try:
        print("Making API request to Fordefi")
        method = "post"
        response_data = make_api_request(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body, method=method)

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

            r, s, v = decode_signature(signature_b64)
            print(f"\nDecoded signature components:")
            print(f"r: {hex(r)}")
            print(f"s: {hex(s)}")
            print(f"v: {v}")

            recovered_address = ecrecover(MESSAGE, signature_hex)
            print(f"\nRecovered signer address: {recovered_address}")

    except requests.exceptions.HTTPError as e:
        error_message = f"HTTP error occurred: {str(e)}"
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                error_message += f"\nError details: {error_detail}"
            except json.JSONDecodeError:
                error_message += f"\nRaw response: {e.response.text}"
        raise RuntimeError(error_message)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error occurred: {str(e)}")
    except Exception as e:
        print(f"Error: {str(e)}")


if __name__ == "__main__":
    main()
