import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from fordefi_protocol_types import TransactionType, SignerType, EvmMessageType, SignMode, TransactionState

def construct_eip712_message_request(vault_id: str, data: str, chain: str) -> dict:
    print(f'Preparing transaction from Vault {vault_id}')
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "sign_mode": SignMode.AUTO.value,
        "type": TransactionType.EVM_MESSAGE.value,
        "details": {
            "type": EvmMessageType.TYPED_MESSAGE.value,
            "raw_data": data,
            "chain": chain
        },
        "vault_id": vault_id,
        "note": "Typed Data message, permit 1inch to spend USDC",
        "wait_for_state": TransactionState.SIGNED.value,
        "timeout": 45,
     }

    return request_json

def construct_personal_message_request(vault_id: str, message: str, chain: str) -> dict:
    print(f'Preparing personal message signing from Vault {vault_id}')
    print(f'Chain: {chain}')
    hex_encoded_message = '0x' + message.encode('utf-8').hex()
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "sign_mode": SignMode.AUTO.value,
        "type": TransactionType.EVM_MESSAGE.value,
        "details": {
            "type": EvmMessageType.PERSONAL_MESSAGE.value,
            "raw_data": hex_encoded_message,
            "chain": chain
        },
        "vault_id": vault_id,
        "wait_for_state": TransactionState.SIGNED.value,
        "timeout": 45
    }

    return request_json
