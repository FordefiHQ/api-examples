import os
import datetime
import base64
import json
import requests
from dotenv import load_dotenv
from signing.signer import sign
from api_requests.push_to_api import make_api_request
from request_builder.construct_request import construct_personal_message_request

# Load Fordefi secrets
load_dotenv()
FORDEFI_API_USER_TOKEN = os.getenv("FORDEFI_API_USER_TOKEN")
FORDEFI_EVM_VAULT_ID = os.getenv("FORDEFI_EVM_VAULT_ID")
PATH = "/api/v1/transactions/create-and-wait"

# EVM chain configuration - see Fordefi docs for supported chains
# Examples: "evm_1" (Ethereum), "evm_137" (Polygon), "evm_42161" (Arbitrum)
EVM_CHAIN = os.getenv("EVM_CHAIN", "evm_1")

# Example message - replace with your actual message
MESSAGE = """Hello, this is a test message to sign.

You can put any content here that you want to sign with your EVM wallet."""


def decode_signature(signature_b64: str) -> tuple:
    """
    Decode a base64 signature into r, s, v components.

    Args:
        signature_b64: Base64 encoded signature from Fordefi

    Returns:
        tuple: (r, s, v) signature components
    """
    signature_bytes = base64.b64decode(signature_b64)
    r = int.from_bytes(signature_bytes[0:32], byteorder='big')
    s = int.from_bytes(signature_bytes[32:64], byteorder='big')
    v = int(signature_bytes[64])

    return r, s, v


def main():
    """Main function to execute the personal message signing process with Fordefi."""

    print(f"Message to sign:\n{MESSAGE}\n")
    print("-" * 50)

    # Build the request
    request_json = construct_personal_message_request(FORDEFI_EVM_VAULT_ID, MESSAGE, EVM_CHAIN)
    request_body = json.dumps(request_json)

    timestamp = datetime.datetime.now().strftime("%s")
    payload = f"{PATH}|{timestamp}|{request_body}"

    signature = sign(payload=payload)

    try:
        print("Making API request to Fordefi")
        method = "post"
        response_data = make_api_request(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body, method=method)

        print("\nResponse Data:")
        print(json.dumps(response_data, indent=2))

        # Extract the signature if returned
        if "signatures" in response_data and response_data["signatures"]:
            signature_b64 = response_data["signatures"][0]
            signature_bytes = base64.b64decode(signature_b64)
            signature_hex = '0x' + signature_bytes.hex()

            print(f"\nSignature (hex): {signature_hex}")

            # Show r, s, v components
            r, s, v = decode_signature(signature_b64)

            print(f"\nDecoded signature components:")
            print(f"r: {hex(r)}")
            print(f"s: {hex(s)}")
            print(f"v: {v}")

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
