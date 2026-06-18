import os
import json
import time
import asyncio
import datetime
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # for simple-api-transfers (utils)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))  # for python (fordefi_protocol_types)
from fordefi_protocol_types import TransactionType, SignerType, GasType, SolanaTransactionDetailType, AssetIdentifierType, AssetDetailType
from utils.broadcast import broadcast_tx, get_tx
from utils.sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

async def build_sponsored_tx(vault_id: str, destination: str, value: str, token: str, fee_payer: str, chain: str):
    print(f"⛽ Fee payer: {fee_payer}")
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.SOLANA_TRANSACTION.value,
        "details": {
            "fee_payer": {
                "type": "vault",
                "vault_id": fee_payer
            },
            "fee": {
                "type": GasType.CUSTOM.value,
                "unit_price": "500" # you can replace unit_price with priority_fee but NOT combine them
            },
            "type": SolanaTransactionDetailType.SOLANA_TRANSFER.value,
            "to": destination,
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": AssetIdentifierType.SOLANA.value,
                "details": {
                    "type": AssetDetailType.SPL_TOKEN.value,
                    "token": {
                        "chain": chain,
                        "base58_repr": token
                    }
                }
            }
        },
        "vault_id": vault_id
    }

    return request_json

def extract_signature(tx: dict):
    sigs = tx.get("signatures")
    if isinstance(sigs, list) and sigs:
        s = sigs[0]
        return s.get("data") if isinstance(s, dict) else s
    return None

async def poll_for_signature(tx_id: str, max_attempts: int = 30, poll_interval_seconds: int = 2):
    state = None
    for _ in range(max_attempts):
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        signature = await sign(payload=f"{path}|{timestamp}|")
        tx = (await get_tx(tx_id, USER_API_TOKEN, signature, timestamp)).json()
        state = tx.get("state")
        sig = extract_signature(tx)
        if sig or state in ("completed", "mined", "failed", "aborted"):
            return state, sig
        time.sleep(poll_interval_seconds)
    return state, None

## CONFIG
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
SOL_VAULT_ID = os.environ["SOL_VAULT_ID"]
FEE_PAYER_VAULT_ID_SOLANA = os.environ["FEE_PAYER_VAULT_ID_SOLANA"]
path = "/api/v1/transactions"
destination = "EjL8jgiEMwuHT6xsDwm7HmF4uqv2cAjJULfXwUm6ZSSD" # Change to your destination address
value = str(1)  # in smallest units (1 USDC = 1_000_000 units)
token_mint_address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" # USDC on Solana mainnet
network = "solana_mainnet"

async def main():
    try:
        ## Building transaction
        request_json = await build_sponsored_tx(vault_id=SOL_VAULT_ID, destination=destination, 
                                    value=value, token=token_mint_address, fee_payer=FEE_PAYER_VAULT_ID_SOLANA, chain=network)
        request_body = json.dumps(request_json)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{request_body}"
         ## Signing transaction with API User private key
        signature = await sign(payload=payload)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        resp = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        tx = resp.json()
        tx_id = tx.get("id")
        print("✅ Transaction submitted successfully!")
        print(f"Transaction ID: {tx_id}")
        ## Poll until the on-chain signature is available
        state, onchain_sig = await poll_for_signature(tx_id)
        if onchain_sig:
            print(f"Signature: {onchain_sig}")
        else:
            print(f"Signature not yet available (last state: {state})")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())