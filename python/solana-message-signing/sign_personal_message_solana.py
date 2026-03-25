import os
import json
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv
from signing.signer import sign_with_api_user_private_key
from request_builder.push_to_api import make_api_request
from request_builder.construct_request import construct_personal_message_request

# Load Fordefi config
load_dotenv()
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
PATH = "/api/v1/transactions/create-and-wait"
FORDEFI_API_USER_TOKEN = os.environ["FORDEFI_API_USER_TOKEN"]
FORDEFI_SOLANA_VAULT_ID = os.environ["FORDEFI_SOLANA_VAULT_ID"]
# Solana chain configuration
# Examples: "solana_mainnet", "solana_devnet"
SOLANA_CHAIN = os.environ.get("SOLANA_CHAIN", "solana_mainnet")

# Example message - replace with your actual message
MESSAGE = """Hello, this is a test message to sign.

You can put any content here that you want to sign with your Fordefi Solana wallet."""


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
