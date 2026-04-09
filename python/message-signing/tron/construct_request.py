import os
import sys
import base64
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from fordefi_protocol_types import TransactionType, SignerType, TronMessageType, SignMode, TransactionState


def construct_personal_message_request(vault_id: str, message: str, chain: str) -> dict:
    print(f'Preparing personal message signing from Vault {vault_id}')
    print(f'Chain: {chain}')
    base64_encoded_message = base64.b64encode(message.encode('utf-8')).decode('utf-8')
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "sign_mode": SignMode.AUTO.value,
        "type": TransactionType.TRON_MESSAGE.value,
        "details": {
            "type": TronMessageType.PERSONAL_MESSAGE_V2.value,
            "raw_data": {
                "format": "base64",
                "raw_data_base64": base64_encoded_message
            },
            "chain": chain
        },
        "vault_id": vault_id,
        "wait_for_state": TransactionState.SIGNED.value,
        "timeout": 45
    }

    return request_json
