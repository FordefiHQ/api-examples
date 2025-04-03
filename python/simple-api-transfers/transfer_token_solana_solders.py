import os
import ecdsa
import hashlib
import requests
import base64
import json
import datetime
from solders.pubkey import Pubkey
from solders.message import Message
from spl.token.instructions import get_associated_token_address, transfer_checked, TransferCheckedParams
from spl.token.constants import TOKEN_PROGRAM_ID
from dotenv import load_dotenv

load_dotenv()

### Helper functions
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

def sign(payload):

    with open(PRIVATE_KEY_FILE, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())

    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )

    return signature

# Fordefi configuration
PRIVATE_KEY_FILE = "./secret/private.pem"
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
FORDEFI_SOLANA_VAULT_ID = os.getenv("SOL_VAULT_ID")
FORDEFI_SOLANA_VAULT_ADDRESS = os.getenv("FORDEFI_SOLANA_VAULT_ADDRESS")
path = "/api/v1/transactions"
destination = "9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS"  # Change to your destination address
custom_note = "USDC transfer"

# USDC specific configuration
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC mint address on Solana mainnet
USDC_DECIMALS = 6 
amount = 1 * 10**USDC_DECIMALS  # 1 USDC

# Derive PubKeys
sender = Pubkey.from_string(FORDEFI_SOLANA_VAULT_ADDRESS)
recipient = Pubkey.from_string(destination)
mint = Pubkey.from_string(USDC_MINT)

# Derive ATAs
sender_token_address = get_associated_token_address(sender, mint)
recipient_token_address = get_associated_token_address(recipient, mint)

# Create a transfer instruction for SPL token
ixs = []
ixs.append(
    transfer_checked(
        TransferCheckedParams(
            source=sender_token_address,
            dest=recipient_token_address,
            owner=sender,
            mint=mint,
            amount=amount,
            decimals=USDC_DECIMALS,
            program_id=TOKEN_PROGRAM_ID
        )
    )
)

# Compile the message for a v0 transaction
# Replace with MessageV0() for v0 message
msg = Message(ixs, sender)

# Preparing payload
request_json = sol_tx_native(vault_id=FORDEFI_SOLANA_VAULT_ID, custom_note=custom_note, msg=msg)
request_body = json.dumps(request_json)
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

# Signing and broadcasting
signature = sign(payload=payload)
resp_tx = broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
print("✅ Transaction submitted successfully!")