import os
import sys
import json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from fordefi_protocol_types import TransactionType, SignerType, StarknetMessageType, SignMode, TransactionState


def construct_typed_message_request(vault_id: str, typed_data: dict, chain: str) -> dict:
    print(f'Preparing SNIP-12 typed message signing from Vault {vault_id}')
    print(f'Chain: {chain}')
    # Starknet `typed_message_type` maps to the SNIP-12 (formerly SNIP-712) standard.
    # The raw_data is the JSON-serialized typed data object.
    raw_data = json.dumps(typed_data)
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "sign_mode": SignMode.AUTO.value,
        "type": TransactionType.STARKNET_MESSAGE.value,
        "details": {
            "type": StarknetMessageType.TYPED_MESSAGE.value,
            "raw_data": raw_data,
            "chain": chain
        },
        "vault_id": vault_id,
        "note": "SNIP-12 typed data message",
        "wait_for_state": TransactionState.SIGNED.value,
        "timeout": 45
    }

    return request_json
