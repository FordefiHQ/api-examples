import os
import time
import datetime
import base64
import json
import requests
from pathlib import Path
from dotenv import load_dotenv
from utils import sign_payload
from utils.broadcast import broadcast_tx

# Load Fordefi secrets
load_dotenv()
API_USER_PRIVATE_KEY = Path("./secret/private.pem")
FORDEFI_API_USER_TOKEN = os.getenv("FORDEFI_API_USER_TOKEN")
FORDEFI_EVM_VAULT_ID = os.getenv("FORDEFI_EVM_VAULT_ID")
PATH = "/api/v1/transactions"

# zkLighter configuration
CHAIN_ID = 304

def construct_onboarding_message(chain_id: int) -> str:
    """Construct the zkLighter onboarding message."""
    timestamp = int(time.time() * 1000)  # Current timestamp in milliseconds

    message = f"""Access zkLighter account.

Only sign this message for a trusted client!
Chain ID: {chain_id}

Timestamp: {timestamp}."""

    return message

def construct_personal_message_request(vault_id: str, message: str, chain: str = "zklighter_mainnet") -> dict:
    """Construct a Fordefi request for signing a personal message."""

    print(f'Preparing personal message signing from Vault {vault_id}')

    # Hex-encode the message
    hex_encoded_message = '0x' + message.encode('utf-8').hex()

    request_json = {
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "evm_message",
        "details": {
            "type": "personal_message_type", 
            "raw_data": hex_encoded_message,
            "chain": chain
        },
        "vault_id": vault_id,
        "note": "zkLighter onboarding message",
        "wait_for_state": "signed"
    }

    return request_json

def main():
    """Main function to execute the personal message signing process with Fordefi."""

    # Construct the onboarding message
    message = construct_onboarding_message(CHAIN_ID)
    print(f"Message to sign:\n{message}\n")

    # Build the request
    request_json = construct_personal_message_request(FORDEFI_EVM_VAULT_ID, message)
    request_body = json.dumps(request_json)

    timestamp = datetime.datetime.now().strftime("%s")
    payload = f"{PATH}|{timestamp}|{request_body}"

    signature = sign_payload(payload=payload)

    try:
        print("Making API request to Fordefi 📡")
        method = "post"
        response_data = broadcast_tx(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body, method=method)

        print("\nResponse Data:")
        print(json.dumps(response_data, indent=2))

        # Extract the signature if returned
        if "signatures" in response_data and response_data["signatures"]:
            signature_b64 = response_data["signatures"][0]
            signature_bytes = base64.b64decode(signature_b64)
            signature_hex = '0x' + signature_bytes.hex()

            print(f"\nSignature (hex): {signature_hex}")

            # Also show r, s, v components
            r = int.from_bytes(signature_bytes[0:32], byteorder='big')
            s = int.from_bytes(signature_bytes[32:64], byteorder='big')
            v = int(signature_bytes[64])

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
