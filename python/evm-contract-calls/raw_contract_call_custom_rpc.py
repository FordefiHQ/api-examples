import os
import sys
import json
import asyncio
import requests
import datetime
from pathlib import Path
from utils.broadcast import broadcast_tx, get_tx
from utils.sign_payload import sign_with_api_user_private_key
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fordefi_protocol_types import TransactionType, SignerType, PushMode, SignMode, GasType, GasPriorityLevel, EvmTransactionDetailType, TransactionState
from dotenv import load_dotenv

load_dotenv()

async def contract_call(evm_chain: str, vault_id: str, contract: str, custom_note: str, value: str, call_data: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": vault_id,
        "note": custom_note,
        "sign_mode": SignMode.AUTO.value,
        "type": TransactionType.EVM_TRANSACTION.value,
        "details": {
            "push_mode": PushMode.MANUAL.value,
            "type": EvmTransactionDetailType.EVM_RAW_TRANSACTION.value,
            "chain": f"evm_{evm_chain}_mainnet",
            "gas": {
                "type": GasType.PRIORITY.value,
                "priority_level": GasPriorityLevel.MEDIUM.value
            },
            "to": contract,
            "value": value,
            "data": {
                "type": "hex",
                "hex_data": call_data
            }
        }
    }
    
    return request_json

## Fordefi configuration
API_USER_PRIVATE_KEY = Path("./secret/private.pem")
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
EVM_VAULT_ID = os.environ["EVM_VAULT_ID"]
evm_chain = "ethereum"
path = "/api/v1/transactions" # CHANGE
contract = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
custom_note = "It's a wrap!" # Optional note
value = str(1_000_000_000) # 0.00001 ETH (1 ETH = 0.000000000000000001 wei)
hex_call_data = "0xd0e30db0"
custom_rpc_url = os.getenv("CUSTOM_RPC_URL")  # Your custom RPC endpoint

async def main():
    if not custom_rpc_url:
        raise ValueError("CUSTOM_RPC_URL environment variable is not set. Please add it to your .env file.")
    try:
        ## Building transaction
        request_json = await contract_call(evm_chain=evm_chain, vault_id=EVM_VAULT_ID, contract=contract, custom_note=custom_note, value=value, call_data=hex_call_data)
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

        ## Poll for raw_transaction to be available
        print("Waiting for transaction to be signed...")
        raw_transaction = None
        while raw_transaction is None:
            await asyncio.sleep(2)
            tx_response = await get_tx(tx_id, USER_API_TOKEN, signature, timestamp)
            tx_details = tx_response.json()
            tx_state = tx_details.get("state", "unknown")

            if tx_state == TransactionState.ABORTED.value:
                print(f"Transaction was aborted!")
                return

            raw_transaction = tx_details.get("raw_transaction")
            if raw_transaction is None:
                print(f"  Status: {tx_state}...")

        print(f"Raw transaction received: {raw_transaction}")

        ## Push raw transaction to custom RPC
        print(f"Broadcast to custom RPC: {custom_rpc_url}")
        rpc_payload = {
            "jsonrpc": "2.0",
            "method": "eth_sendRawTransaction",
            "params": [raw_transaction],
            "id": 1
        }
        rpc_response = requests.post(custom_rpc_url, json=rpc_payload)
        rpc_result = rpc_response.json()

        if "error" in rpc_result:
            raise RuntimeError(f"RPC error: {rpc_result['error']}")

        tx_hash = rpc_result.get("result")
        print(f"Transaction broadcast successfully!")
        print(f"Transaction hash: {tx_hash}")

    except Exception as e:
        print(f"Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())