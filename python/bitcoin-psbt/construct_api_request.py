from typing import Any

async def build_request(vault_id: str, vault_address: str, psbt_hex_data: str, will_auto_finalize: bool, is_bitcoin_mainnet: bool) -> dict[str, Any]:
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
            "signer_type": "api_signer",
            "sign_mode": "auto",
            "type": "utxo_transaction",
            "details": {
                "type": "utxo_partially_signed_bitcoin_transaction",
                "psbt_raw_data": psbt_hex_data,
                "auto_finalize": will_auto_finalize,
                "sender": { # The address that will sign the inputs
                    "address": vault_address, # Must be from a Fordefi Vault
                    "address_type": address_type,
                    "chain": {
                        "chain_type": "utxo",
                        "unique_id": "bitcoin_mainnet" if is_bitcoin_mainnet else "bitcoin_testnet" ## testnet v3
                    },
                },
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
                "push_mode": "auto"
            }
    }
    return request_json