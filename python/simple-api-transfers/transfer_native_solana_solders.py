import os
import base64
import json
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from solders.pubkey import Pubkey
from solders.message import Message
from solders.system_program import TransferParams, transfer
from dotenv import load_dotenv

load_dotenv()

def sol_tx_native(vault_id, custom_note, msg):

    request_json = {
        "signer_type": "api_signer",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "data": base64.b64encode(bytes(msg)).decode(),
            "chain": "solana_mainnet"
        },
        "note": custom_note,
        "vault_id": vault_id
    }
    
    return request_json

## Fordefi configuration
PRIVATE_KEY_FILE = "./secret/private.pem"
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
FORDEFI_SOLANA_VAULT_ID = os.getenv("SOL_VAULT_ID")
FORDEFI_SOLANA_VAULT_ADDRESS = os.getenv("FORDEFI_SOLANA_VAULT_ADDRESS")
path = "/api/v1/transactions"
destination = "9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS" # Change to your Fordefi Solana Vault
custom_note = "hello!" # Optional note
amount = 1 # SOL in lamports

sender = Pubkey.from_string(FORDEFI_SOLANA_VAULT_ADDRESS)
recipient = Pubkey.from_string(destination)

# Create a transfer instruction of 1 lamport
ixs = []
ixs.append( 
    transfer(
        TransferParams(
            from_pubkey=sender,
            to_pubkey=recipient,
            lamports=amount
        )
    )
)

# Compile the message for a v0 transaction
# Replace with MessageV0() for v0 message
msg = Message(ixs, sender) 

## Preparing payload
request_json = sol_tx_native(vault_id=FORDEFI_SOLANA_VAULT_ID, custom_note=custom_note, msg=msg)
request_body = json.dumps(request_json)
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

## Signing transaction with API Signer 
signature = sign(payload=payload)

## Broadcasting tx
resp_tx = broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
print("✅ Transaction submitted successfully!")