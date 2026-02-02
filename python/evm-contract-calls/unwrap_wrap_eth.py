import os
import json
import base64
import asyncio
import datetime
from pathlib import Path
from dotenv import load_dotenv
from eth_account import Account
from utils.broadcast import broadcast_tx, get_tx
from utils.sign_payload import sign_with_api_user_private_key

load_dotenv()

async def wrap_unwrap(evm_chain: str, vault_id: str, custom_note: str, amount: str, is_wrap: bool):
    request_json = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": custom_note,
        "sign_mode": "auto",
        "type": "evm_transaction",
        "details": {
            # "fail_on_prediction_failure": True,
            # "skip_prediction": False,
            "push_mode": "auto",
            "type": "evm_wrap_eth" if is_wrap else "evm_unwrap_eth",
            "chain": f"evm_{evm_chain}_mainnet",
            "gas": {
                "gas_limit": "100000",
                "type": "custom",
                "details": {
                    "type": "legacy",
                    "price": "1000000000" # 1 GWEI
                }
            },
            "amount": amount,
        }
    }
    
    return request_json

## Fordefi configuration
API_USER_PRIVATE_KEY = Path("./secret/private.pem")
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"]
evm_chain = "ethereum"
path = "/api/v1/transactions" # CHANGE
amount_to_wrap_or_unwrap = str(1_000_000_000) # 0.00001 ETH (1 ETH = 0.000000000000000001 wei)
custom_note = "It's a wrap!" # Optional note
is_wrap = True


def decode_signature(signature_b64, chain_id):
    signature = base64.b64decode(signature_b64)
    r = int.from_bytes(signature[0:32], byteorder='big')
    s = int.from_bytes(signature[32:64], byteorder='big')
    v_raw = int(signature[-1]) # 27 or 28
    v = v_raw + 35 + 2 * chain_id
    return r, s, v

def ecrecover_from_raw_tx(signed_tx_hex: str) -> str:
    recovered_address = Account.recover_transaction(signed_tx_hex)
    return recovered_address

async def main():
    try:
        ## Building transaction
        request_json = await build_tx(
            evm_chain=evm_chain, 
            vault_id=EVM_VAULT_ID, 
            custom_note=custom_note,
            amount= amount_to_wrap_or_unwrap,
            is_wrap=is_wrap
        )
        request_body = json.dumps(request_json)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{request_body}"
        ## Signing transaction with API User private key
        signature = await sign_with_api_user_private_key(payload=payload, api_user_private_key=API_USER_PRIVATE_KEY)
        ## Push tx to Fordefi for MPC signing and broadcast to network
        ok = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, request_body)
        tx_data = ok.json()
        tx_id = tx_data.get("id")
        print(f"Transaction submitted successfully!")
        print(f"Transaction ID: {tx_id}")

        print("Waiting for transaction to be signed...")
        raw_transaction = None
        while raw_transaction is None:
            await asyncio.sleep(2)
            tx_response = await get_tx(tx_id, USER_API_TOKEN, signature, timestamp)
            tx_details = tx_response.json()
            tx_state = tx_details.get("state", "unknown")

            if tx_state == "aborted":
                print(f"Transaction was aborted!")
                return

            raw_transaction = tx_details.get("raw_transaction")
            if raw_transaction is None:
                print(f"  Status: {tx_state}...")

        print(f"Transaction signed and broadcast successfully!")
        print(f"Raw transaction: {raw_transaction}")

        # OPTIONAL Recover signer from the signed raw transaction
        recovered_address = ecrecover_from_raw_tx(raw_transaction)
        print(f"\nRecovered signer address: {recovered_address}")

    except Exception as e:
        print(f"Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())