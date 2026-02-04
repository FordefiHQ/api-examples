import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fordefi_protocol_types import TransactionType, SignerType, PushMode, SignMode, UtxoTransactionDetailType, GasType
from typing import Any

async def build_psbt_request(vault_id: str, vault_address: str, psbt_hex_data: str, will_auto_finalize: bool, uses_custom_rpc: bool = False) -> dict[str, Any]:
    print(f'Preparing transaction from Vault {vault_id}')
    print(f"Vault address: {vault_address}")
    if vault_address.startswith(('bc1q', 'tb1q')):
        address_type = "segwit"
    elif vault_address.startswith(('bc1p', 'tb1p')):
        address_type = "taproot"
    elif vault_address.startswith(('1', '3', 'm', 'n', '2')):
        raise ValueError(f"Legacy Bitcoin addresses are not supported. Address: {vault_address}")
    else:
        raise ValueError(f"Unknown Bitcoin address format: {vault_address}")
    print(f"Address type: {address_type}")
    request_json = {
            "vault_id": vault_id,
            "note": "string",
            "signer_type": SignerType.API_SIGNER.value,
            "sign_mode": SignMode.AUTO.value,
            "type": TransactionType.UTXO_TRANSACTION.value,
            "details": {
                "type": UtxoTransactionDetailType.UTXO_PARTIALLY_SIGNED_BITCOIN_TRANSACTION.value,
                "psbt_raw_data": psbt_hex_data,
                "auto_finalize": will_auto_finalize,
                "signer": vault_address,
                "inputs": [ # OPTIONAL array describing how each input will be signed
                    {
                        "index": 0,
                        "signer_identity":{
                            "type": "address",
                            "address": vault_address
                        }
                    }
                    # OPTIONAL -> add more inputs here as needed
                ],
                "fee_per_byte": {
                    "fee_per_byte": "1",
                    "type": GasType.CUSTOM.value
                },
                "push_mode": PushMode.MANUAL.value if uses_custom_rpc else PushMode.AUTO.value
            }
    }
    return request_json
