import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))
from fordefi_protocol_types import TransactionType, SignerType, SolanaTransactionDetailType, ExchangeTransactionDetailType, AssetIdentifierType, AssetDetailType

async def format_deposit_native_sol(vault_id: str, destination: str, custom_note: str, value: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.SOLANA_TRANSACTION.value,
        "vault_id": vault_id,
        "note": custom_note,
        "details": {
            "type": SolanaTransactionDetailType.SOLANA_TRANSFER.value,
            "to": destination,
            "asset_identifier": {
                "type": AssetIdentifierType.SOLANA.value,
                "details": {
                    "type": AssetDetailType.NATIVE.value,
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

async def format_ex_to_ex_withdrawal_token_evm(vault_id: str, destination: str, custom_note: str, value: str, origin_exchange: str, asset: str):
    request_json = {
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EXCHANGE_TRANSACTION.value,
        "details": {
            "asset_identifier": {
                "asset_symbol": asset,
                "exchange_type": origin_exchange,
                "type": "exchange"
            },
            "chain": "evm_ethereum_mainnet",
            "to": {
                "vault_id": destination,
                "type": "vault"
            },
            "type": ExchangeTransactionDetailType.EXTERNAL_WITHDRAW.value,
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
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EXCHANGE_TRANSACTION.value,
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
            "type": ExchangeTransactionDetailType.EXTERNAL_WITHDRAW.value,
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
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EXCHANGE_TRANSACTION.value,
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
            "type": ExchangeTransactionDetailType.EXTERNAL_WITHDRAW.value,
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
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EXCHANGE_TRANSACTION.value,
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
            "type": ExchangeTransactionDetailType.EXTERNAL_WITHDRAW.value,
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
        "signer_type": SignerType.API_SIGNER.value,
        "type": TransactionType.EXCHANGE_TRANSACTION.value,
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
            "type": ExchangeTransactionDetailType.EXTERNAL_WITHDRAW.value,
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
