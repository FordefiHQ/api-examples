import os
import ecdsa
import hashlib
import requests
import base64
import json
import datetime


### FUNCTIONS

def broadcast_tx(path, access_token, signature, timestamp, request_body):

    try:
        resp_tx = requests.post(
            f"https://api.fordefi.com{path}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "x-signature": base64.b64encode(signature),
                "x-timestamp": timestamp.encode(),
            },
            data=request_body,
        )
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


def evm_tx_native(evm_chain, vault_id, destination, custom_note, value):

    value_in_wei = str(int(float(value) * 10**18))
    print(f"⚙️ Preparing tx for {value}!")

    """
    Native ETH or BNB transfer

    """

    request_json = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": custom_note,
        "type": "evm_transaction",
        "details": {
            "type": "evm_transfer",
            "gas": {
                "type": "priority",
                "priority_level": "medium"
            },
            "to": destination,
            "asset_identifier": {
                "type": "evm",
                "details": {
                    "type": "native",
                    "chain": f"evm_{evm_chain}_mainnet"
                }
            },
            "value": {
                "type": "value",
                "value": value_in_wei
            }
        }
    }
    
    return request_json


def sign(payload):

    ## LOCAL USE
    PRIVATE_KEY_FILE = "./secret/private.pem"
    with open(PRIVATE_KEY_FILE, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())

    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )

    return signature

### Core logic

## Set config
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
evm_chain = "bsc"
#evm_chain = "ethereum"  
path = "/api/v1/transactions"
vault_id = "81e82853-3c4f-4cd4-b494-78fb4abf168a" # CHANGE
destination = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93" # CHANGE
custom_note = "hello!"
value = "0.0001" # BNB or ETH

## Building transaction
request_json = evm_tx_native(evm_chain=evm_chain, vault_id=vault_id, destination=destination, custom_note=custom_note, value=value)
request_body = json.dumps(request_json)
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

## Sign transaction with API Signer (local)
signature = sign(payload=payload)

## Broadcast tx
resp_tx = broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
print("✅ Transaction submitted successfully!")