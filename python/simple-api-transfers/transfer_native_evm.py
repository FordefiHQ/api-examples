import os
import json
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

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

## Fordefi configuration
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
EVM_VAULT_ID = os.getenv("EVM_VAULT_ID")
evm_chain = "bsc"
path = "/api/v1/transactions" # CHANGE
destination = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93" # CHANGE
custom_note = "hello!"
value = "0.0001" # BNB or ETH

## Building transaction
request_json = evm_tx_native(evm_chain=evm_chain, vault_id=EVM_VAULT_ID, destination=destination, custom_note=custom_note, value=value)
request_body = json.dumps(request_json)
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

## Signing transaction with API Signer
signature = sign(payload=payload)

## Broadcasting tx
resp_tx = broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
print("✅ Transaction submitted successfully!")