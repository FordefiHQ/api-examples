import os  # noqa: I001
import sys
import json
import time
import base64
import base58
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.signer import sign_with_api_user_private_key  # noqa: I001
from shared.api_client import make_api_request
from solana.construct_request import construct_personal_message_request

# Load Fordefi config
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
PRIVATE_KEY_PEM_FILE = Path(__file__).resolve().parent.parent / "secret" / "private.pem"
PATH = "/api/v1/transactions"
POLL_INTERVAL_SECONDS = 2
MAX_POLL_ATTEMPTS = 60
FORDEFI_API_USER_TOKEN = os.environ["FORDEFI_API_USER_TOKEN"]
FORDEFI_SOLANA_VAULT_ID = os.environ["FORDEFI_SOLANA_VAULT_ID"]
# Solana chain configuration
# Examples: "solana_mainnet", "solana_devnet"
SOLANA_CHAIN = os.environ.get("SOLANA_CHAIN", "solana_mainnet")

# Example message - replace with your actual message
MESSAGE = "Go Fordefi!"


def extract_signature(tx: dict):
    signatures = tx.get("signatures")
    return signatures[0]["data"] if signatures else None

def poll_for_signature(tx_id: str):
    for attempt in range(MAX_POLL_ATTEMPTS):
        response = requests.get(
            f"https://api.fordefi.com{PATH}/{tx_id}",
            headers={"Authorization": f"Bearer {FORDEFI_API_USER_TOKEN}"},
        )
        response.raise_for_status()
        tx = response.json()
        state = tx.get("state")
        print(f"  Attempt {attempt + 1}: state = {state}")

        if extract_signature(tx):
            return tx
        if state in ("aborted", "failed", "rejected"):
            raise RuntimeError(f"Transaction reached terminal state '{state}' without a signature")

        time.sleep(POLL_INTERVAL_SECONDS)

    return None

def main():
    print(f"Message to sign:\n{MESSAGE}\n")
    print("-" * 50)

    request_json = construct_personal_message_request(FORDEFI_SOLANA_VAULT_ID, MESSAGE, SOLANA_CHAIN)
    request_body = json.dumps(request_json)

    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    payload = f"{PATH}|{timestamp}|{request_body}"

    signature = sign_with_api_user_private_key(payload=payload, api_user_private_key=PRIVATE_KEY_PEM_FILE)

    try:
        print("Making API request to Fordefi")
        method = "post"
        response_data = make_api_request(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body, method=method)
        tx_id = response_data["id"]
        print(f"\n✅ Transaction submitted! ID: {tx_id}")

        print(f"Polling {PATH}/{tx_id} for the signature")
        tx = poll_for_signature(tx_id)

        if tx is None:
            print("\n⏳ Timed out waiting for the signature.")
            print("   Note: The transaction is NOT cancelled - it can still be approved and signed.")
            print(f"   Transaction ID: {tx_id}")
            print(f"   Track status: GET /api/v1/transactions/{tx_id}")
            print("   Docs: https://docs.fordefi.com/api/latest/openapi/transactions/get_transaction_api_v1_transactions__id__get")
            return

        signature_b64 = str(extract_signature(tx))
        print(f"\nSigned message: {tx['string_data']}")
        print(f"Signer wallet: {tx['sender']['address']}")
        signature_bytes = base64.b64decode(signature_b64)
        print(f"Signature (base58): {base58.b58encode(signature_bytes).decode()}")
        print(f"Signature (hex): {signature_bytes.hex()}")

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
