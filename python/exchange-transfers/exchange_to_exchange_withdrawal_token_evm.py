import os
import ecdsa
import hashlib
import requests
import base64
import json
import datetime
from dotenv import load_dotenv
load_dotenv()


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


def sol_tx_native(vault_id, destination, custom_note, value, exchange):

    request_json = {
        "signer_type": "api_signer",
        "type": "exchange_transaction",
        "details": {
            "asset_identifier": {
                "asset_symbol": "USDC",
                "exchange_type": exchange,
                "type": "exchange"
            },
            "chain": "evm_ethereum_mainnet",
            "to": {
                "vault_id": destination,
                "type": "vault"
            },
            "type": "external_withdraw",
            "value": {
                "is_net_amount": True,
                "type": "value",
                "value": value
            }
        },
        "vault_id": vault_id,
        "note": custom_note
    }
    
    return request_json

def sign(payload):

    PRIVATE_KEY_FILE = "./secret/private.pem"
    with open(PRIVATE_KEY_FILE, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())

    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )

    return signature

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
COINBASE_EXCHANGE_VAULT_ID = os.getenv("COINBASE_EXCHANGE_VAULT_ID")
BINANCE_EXCHANGE_VAULT_ID = os.getenv("BINANCE_EXCHANGE_VAULT_ID")
path = "/api/v1/transactions"
destination = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73" # CHANGE to your destination address
custom_note = "hello!"
value = "1000000000000000000"# Amount represents 1 USDC (using 18-decimal precision required by Fordefi API, regardless of asset's native decimals)
exchange_name = "coinbase_international"

## Building transaction
request_json = sol_tx_native(vault_id=COINBASE_EXCHANGE_VAULT_ID, destination=BINANCE_EXCHANGE_VAULT_ID, custom_note=custom_note, value=value, exchange=exchange_name)
request_body = json.dumps(request_json)
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

## Signing transaction with API Signer (local)
signature = sign(payload=payload)

## Broadcasting tx
resp_tx = broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
print("✅ Transaction submitted successfully!")