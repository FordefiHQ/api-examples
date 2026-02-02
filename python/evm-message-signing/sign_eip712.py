import os
import json
import base64
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv
from eth_account import Account
from eth_account.messages import encode_typed_data
from request_builder.push_to_api import make_api_request
from signing.signer import sign_with_api_user_private_key
from request_builder.construct_request import construct_eip712_message_request

# Load Fordefi secrets
load_dotenv()
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
PATH = "/api/v1/transactions/create-and-wait"
FORDEFI_API_USER_TOKEN = os.environ["FORDEFI_API_USER_TOKEN"]
FORDEFI_EVM_VAULT_ID = os.environ["FORDEFI_EVM_VAULT_ID"]
# EVM chain configuration
# Examples: "evm_1" (Ethereum), "evm_137" (Polygon), "evm_42161" (Arbitrum)
EVM_CHAIN = os.environ["EVM_CHAIN"]

# Example typed data
typed_data = {
    "types": {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"}
        ],
        "Permit": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "nonce", "type": "uint256"},
            {"name": "deadline", "type": "uint256"}
        ]
    },
    "domain": {
        "name": "USD Coin",
        "version": "2",
        "chainId": 1,
        "verifyingContract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    },
    "primaryType": "Permit",
    "message": {
        "owner": "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
        "spender": "0x1111111254fb6c44bac0bed2854e76f90643097d",
        "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935", # large uints must be stringified
        "nonce": 1000,
        "deadline": 1767166198
    }
}

def decode_signature(signature_b64, chain_id):
    signature = base64.b64decode(signature_b64)
    r = int.from_bytes(signature[0:32], byteorder='big')
    s = int.from_bytes(signature[32:64], byteorder='big')
    v_raw = int(signature[-1]) # 27 or 28
    v = v_raw + 35 + 2 * chain_id
    return r, s, v

def ecrecover(typed_data: dict, signature_hex: str) -> str:
    signable_message = encode_typed_data(full_message=typed_data)
    recovered_address = Account.recover_message(signable_message, signature=signature_hex)
    return recovered_address

def main():
    raw_typed_message_ = json.dumps(typed_data)

    # OPTIONAL -> hex-encode the raw typed message
    hex_encoded_typed_message = '0x' + raw_typed_message_.encode('utf-8').hex()

    # You can pass the typed message in its raw version or hex-encoded
    request_json = construct_eip712_message_request(FORDEFI_EVM_VAULT_ID, hex_encoded_typed_message, EVM_CHAIN)
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

                r, s, v = decode_signature(signature_b64, typed_data["domain"]["chainId"])
                print(f"\nDecoded signature components:")
                print(f"r: {hex(r)}")
                print(f"s: {hex(s)}")
                print(f"v: {v}")

                recovered_address = ecrecover(typed_data, signature_hex)
                print(f"\nRecovered signer address: {recovered_address}")

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