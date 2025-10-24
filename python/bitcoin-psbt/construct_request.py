async def build_request(vault_id, vault_address, raw_psbt_bytes):
    print(f'Preparing transaction from Vault {vault_id}')
    print(f"Vault address: {vault_address}")
    if vault_address.startswith('bc1q'):
        # Native SegWit (P2WPKH) - Bech32
        address_type = "segwit"
    elif vault_address.startswith('bc1p'):
        # Taproot (P2TR) - Bech32m
        address_type = "taproot"
    elif vault_address.startswith('1') or vault_address.startswith('3'):
        # Legacy addresses (P2PKH or P2SH)
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
                "psbt_raw_data": raw_psbt_bytes,
                "auto_finalize": True,
                "sender": { # The address that will sign the inputs
                    "address": vault_address, # Must be from a Fordefi Vault
                    "address_type": address_type,
                    "chain": {
                        "chain_type": "utxo",
                        "unique_id": "bitcoin_mainnet"
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