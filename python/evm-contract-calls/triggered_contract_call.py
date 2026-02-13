import os
import sys
import json
import time
import requests
import datetime
from pathlib import Path
from dotenv import load_dotenv
from utils.sign_payload import sign_with_api_user_private_key
from utils.broadcast import broadcast_tx, poll_until_waiting_for_signing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fordefi_protocol_types import (
    TransactionType,
    SignerType,
    SignMode,
    GasType,
    PushMode,
    GasDetailsType,
    EvmTransactionDetailType,
)

load_dotenv()

FORDEFI_API_BASE_URL = "https://api.fordefi.com"
PEM_FILE_PATH = Path("./secret/private.pem")
API_USER_TOKEN = os.environ["FORDEFI_API_TOKEN"]
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"]
CHAIN = "ethereum"
CONTRACT = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
CALL_DATA = "0xd0e30db0"
should_trigger = False

def build_triggered_tx_payload(vault_id: str) -> dict:
    return {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "sign_mode": SignMode.TRIGGERED.value,
        "type": TransactionType.EVM_TRANSACTION.value,
        "details": {
            # "fail_on_prediction_failure": True,
            # "skip_prediction": False,
            "push_mode": PushMode.AUTO.value,
            "type": EvmTransactionDetailType.EVM_RAW_TRANSACTION.value,
            "chain": f"evm_{CHAIN}_mainnet",
            "gas": {
                "gas_limit": "1000000",
                "type": GasType.CUSTOM.value,
                "details": {
                    "type": GasDetailsType.LEGACY.value,
                    "price": "1000000000" # 1 GWEI
                }
            },
            "to": CONTRACT,
            "value": "0",
            "data": {
                "type": "hex",
                "hex_data": CALL_DATA
            },
        }
    }


async def create_triggered_transaction(
    api_access_token: str,
    vault_id: str,
) -> dict:
    path = "/api/v1/transactions"
    request_body = build_triggered_tx_payload(vault_id)
    request_json = json.dumps(request_body)
    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    payload = f"{path}|{timestamp}|{request_json}"
    signature = await sign_with_api_user_private_key(payload=payload, api_user_private_key=PEM_FILE_PATH)

    response = await broadcast_tx(path, api_access_token, signature, timestamp, request_json)
    return response.json()


def trigger_signing(api_access_token: str, transaction_id: str) -> None:
    response = requests.post(
        f"{FORDEFI_API_BASE_URL}/api/v1/transactions/{transaction_id}/trigger-signing",
        headers={"Authorization": f"Bearer {api_access_token}"},
    )
    response.raise_for_status()


async def main():
    print("Step 1: Creating triggered revoke-allowance transaction...")
    created_transaction = await create_triggered_transaction(API_USER_TOKEN, EVM_VAULT_ID)
    transaction_id = created_transaction["id"]
    print(f"  Transaction created: {transaction_id}")
    print(f"  Initial state: {created_transaction['state']}")

    print("\nStep 2: Polling until transaction reaches 'waiting_for_signing_trigger'...")
    await poll_until_waiting_for_signing(API_USER_TOKEN, transaction_id)
    print(f"  Transaction {transaction_id} is ready for signing trigger.")

    # Optional: trigger signing after 5 seconds
    if should_trigger == 'y':
        print("Step 3: Triggering signing...")
        trigger_signing(API_USER_TOKEN, transaction_id)
        print("  Signing triggered successfully.")
    else:
        print(f"Skipping trigger. You can manually tigger this transaction later: {transaction_id}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
