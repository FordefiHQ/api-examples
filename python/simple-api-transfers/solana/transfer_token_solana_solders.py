import os
import base64
import json
import asyncio
import datetime
from utils.broadcast import broadcast_tx
from utils.sign_payload import sign
from solders.pubkey import Pubkey
from solders.message import Message
from spl.token.instructions import get_associated_token_address, transfer_checked, TransferCheckedParams
from spl.token.constants import TOKEN_PROGRAM_ID
from dotenv import load_dotenv

load_dotenv()

async def sol_tx_native(vault_id: str, custom_note: str, msg: Message):
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

# Fordefi configuration
PRIVATE_KEY_FILE = "./secret/private.pem"
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
FORDEFI_SOLANA_VAULT_ID = os.environ["SOL_VAULT_ID"]
FORDEFI_SOLANA_VAULT_ADDRESS = os.environ["FORDEFI_SOLANA_VAULT_ADDRESS"]
path = "/api/v1/transactions"
destination = "9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS"  # Change to your destination address
custom_note = "USDC transfer"

# USDC specific configuration
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" 
USDC_DECIMALS = 6 # USDC mint address on Solana mainnet
amount = 1_000_000  # 1 USDC

async def main():
    try:
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
        request_json = await sol_tx_native(vault_id=FORDEFI_SOLANA_VAULT_ID, custom_note=custom_note, msg=msg)
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API User private key
        signature = await sign(payload=payload)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())