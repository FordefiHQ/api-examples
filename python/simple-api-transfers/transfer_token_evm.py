import os
import ecdsa
import hashlib
import requests
import base64
import json
import datetime
from decimal import Decimal
from dotenv import load_dotenv
load_dotenv()

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


def evm_tx_tokens(evm_chain, vault_id, destination, custom_note, value, token):

    if evm_chain == "bsc":
        if token == "usdt":
            contract_address = "0x55d398326f99059fF775485246999027B3197955"
            value = str(int(Decimal(value) * Decimal('1000000000000000000'))) # 18 decimals
        else:
            raise ValueError(f"Token '{token}' is not supported for chain '{evm_chain}'") 
    elif evm_chain == "ethereum":
        if token == "usdt":
            contract_address = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
            value = str(int(Decimal(value) * Decimal('1000000')))  # 6 decimals
        elif token == "pepe":
            contract_address = "0x6982508145454Ce325dDbE47a25d4ec3d2311933"
            value = str(int(Decimal(value) * Decimal('1000000000000000000'))) # 18 decimals
        else:
            raise ValueError(f"Token '{token}' is not supported for chain '{evm_chain}'") 
    else:
        raise ValueError(f"Token '{token}' is not supported for chain '{evm_chain}'")

    request_json =  {
    "signer_type": "api_signer",
    "type": "evm_transaction",
    "details": {
        "type": "evm_transfer",
        "gas": {
          "type": "priority",
          "priority_level": "medium"
        },
        "to": destination,
        "value": {
           "type": "value",
           "value": value
        },
        "asset_identifier": {
             "type": "evm",
             "details": {
                 "type": "erc20",
                 "token": {
                     "chain": f"evm_{evm_chain}_mainnet",
                     "hex_repr": contract_address
                 }
             }
        }
    },
    "note": custom_note,
    "vault_id": vault_id
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

### CORE LOGIC

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
EVM_VAULT_ID = os.getenv("EVM_VAULT_ID")
evm_chain = "bsc"
path = "/api/v1/transactions"
destination = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93" # CHANGE
custom_note = "hello!"
value = "0.0001"
token_ticker = "usdt"
## CONFIG

## Building transaction
request_json = evm_tx_tokens(evm_chain=evm_chain, vault_id=EVM_VAULT_ID, destination=destination, custom_note=custom_note, value=value, token=token_ticker)
request_body = json.dumps(request_json)
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

## Signing transaction with API Signer
signature = sign(payload=payload)

## Broadcasting transaction
resp_tx = broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
print("✅ Transaction submitted successfully!")