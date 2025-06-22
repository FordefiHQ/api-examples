async def format_deposit_native_sol(vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "solana_transaction",
        "vault_id": vault_id,
        "note": custom_note,
        "details": {
            "type": "solana_transfer",
            "to": destination,
            "asset_identifier": {
                "type": "solana",
                "details": {
                    "type": "native",
                    "chain": "solana_mainnet"
            }
            },
            "value": {
                "type": "value",
                "value": value
            }
        }
    }
    
    return request_json

async def format_ex_to_ex_withdrawal_token_evm(vault_id: str, destination: str, custom_note: str, value: str, exchange: str, asset: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "exchange_transaction",
        "details": {
            "asset_identifier": {
                "asset_symbol": asset,
                "exchange_type": exchange,
                "type": "exchange"
            },
            "chain": "evm_ethereum_mainnet",
            "to": {
                "vault_id": destination,
                "type": "vault"
            },
            "type": "external_withdraw",
            "value": {
                "is_net_amount": True,
                "type": "value",
                "value": value
            }
        },
        "vault_id": vault_id,
        "note": custom_note
    }
    
    return request_json

async def format_withdraw_native_sol(vault_id: str, destination: str, custom_note: str, value: str, exchange: str, asset: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "exchange_transaction",
        "details": {
            "asset_identifier": {
                "asset_symbol": asset,
                "exchange_type": exchange,
                "type": "exchange"
            },
            "chain": "solana_mainnet",
            "to": {
                "address": destination,
                "type": "address"
            },
            "type": "external_withdraw",
            "value": {
                "is_net_amount": True,
                "type": "value",
                "value": value
            }
        },
        "vault_id": vault_id,
        "note": custom_note
    }
    
    return request_json

async def format_withdraw_native_ethereum(vault_id: str, destination: str, custom_note: str, value: str, exchange: str, asset: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "exchange_transaction",
        "details": {
            "asset_identifier": {
                "asset_symbol": asset,
                "exchange_type": exchange,
                "type": "exchange"
            },
            "chain": "evm_ethereum_mainnet",
            "to": {
                "address": destination,
                "type": "address"
            },
            "type": "external_withdraw",
            "value": {
                "is_net_amount": True,
                "type": "value",
                "value": value
            }
        },
        "vault_id": vault_id,
        "note": custom_note
    }
    
    return request_json

async def format_withdraw_token_evm(vault_id: str, destination: str, custom_note: str, value: str, exchange: str, chain: str, asset: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "exchange_transaction",
        "details": {
            "asset_identifier": {
                "asset_symbol": asset,
                "exchange_type": exchange,
                "type": "exchange"
            },
            "chain": f"evm_{chain}_mainnet",
            "to": {
                "address": destination,
                "type": "address"
            },
            "type": "external_withdraw",
            "value": {
                "is_net_amount": True,
                "type": "value",
                "value": value
            }
        },
        "vault_id": vault_id,
        "note": custom_note
    }
    
    return request_json

async def format_withdraw_trc20(vault_id: str, destination: str, custom_note: str, value: str, exchange: str, chain: str, asset: str):
    request_json = {
        "signer_type": "api_signer",
        "type": "exchange_transaction",
        "details": {
            "asset_identifier": {
                "asset_symbol": asset,
                "exchange_type": exchange,
                "type": "exchange"
            },
            "chain": f"{chain}_mainnet",
            "to": {
                "address": destination,
                "type": "address"
            },
            "type": "external_withdraw",
            "value": {
                "is_net_amount": True,
                "type": "value",
                "value": value
            }
        },
        "vault_id": vault_id,
        "note": custom_note
    }
    
    return request_json