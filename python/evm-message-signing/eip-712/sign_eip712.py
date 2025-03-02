import os
import datetime
import base64
import json
import requests
from dotenv import load_dotenv
from signing.signer import sign
from api_requests.push_to_api import make_api_request
from request_builder.construct_request import construct_request

load_dotenv()
FORDEFI_API_USER_TOKEN = os.getenv("FORDEFI_API_USER_TOKEN")
FORDEFI_EVM_VAULT_ID = os.getenv("FORDEFI_EVM_VAULT_ID")
PATH = "/api/v1/transactions/create-and-wait"

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
        "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        "nonce": 1000,
        "deadline": 1767166198
    }
}

def decode_signature(signature_b64, chain_id):

    """Decode a base64 signature into r, s, v components."""

    signature = base64.b64decode(signature_b64)
    r = int.from_bytes(signature[0:32], byteorder='big')
    s = int.from_bytes(signature[32:64], byteorder='big')
    v_raw = int(signature[-1]) # 27 or 28
    v = v_raw + 35 + 2 * chain_id
    
    return r, s, v

def main():

    """Main function to execute the EIP-712 signing process with Fordefi"""
    

    raw_typed_message_ = json.dumps(typed_data)

    # OPTIONAL -> hex-encode the raw typed message
    hex_encoded_typed_message = '0x' + raw_typed_message_.encode('utf-8').hex()

    # You can pass the typed message in its raw version or hex-encoded
    request_json = construct_request(FORDEFI_EVM_VAULT_ID, hex_encoded_typed_message)

    request_body = json.dumps(request_json)

    timestamp = datetime.datetime.now().strftime("%s")
    payload = f"{PATH}|{timestamp}|{request_body}"
        
    signature = sign(payload=payload)

    try: 
  
        print("Making API request to Fordefi 📡")
        method = "post" 
        resp_tx = make_api_request(PATH, FORDEFI_API_USER_TOKEN, signature, timestamp, request_body, method=method)

        try:

            response_data = resp_tx.json()
            print("\nResponse Data:")
            print(json.dumps(response_data, indent=2))

            # OPTIONAL -> decode the signature if returned
            if "signatures" in response_data and response_data["signatures"]:
                signature_b64 = response_data["signatures"][0]
                
                chain_id = typed_data["domain"]["chainId"]
                r, s, v = decode_signature(signature_b64, chain_id)
                
                print("\nDecoded signature:")
                print(f"r: {hex(r)}")
                print(f"s: {hex(s)}")
                print(f"v: {v}")

        except json.JSONDecodeError:
            print("Failed printing response data!")
        
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
    main()