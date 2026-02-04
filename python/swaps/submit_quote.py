import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fordefi_protocol_types import SignerType, GasType, GasPriorityLevel, AssetDetailType

async def submit_native_to_erc20_quote(quote_id: str, vault_id: str, chain_type: str, origin_network: str, destination_network: str, sell_token_amount: str, buy_token_address: str, providers: list, slippage: str) -> dict:
    print("Submitting Native to ERC20 quote: ", quote_id)
    submit_response = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": AssetDetailType.NATIVE.value,
            "chain": origin_network
            }
        },
        "output_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": AssetDetailType.ERC20.value,
            "token": {
                "chain": destination_network,
                "hex_repr": buy_token_address
            }
            }
        },
        "amount": sell_token_amount,
        "slippage_bps": slippage,
        "fee": {
            "type": "evm",
            "details": {
                "gas_limit": "21000",
                "type": GasType.PRIORITY.value,
                "priority_level": GasPriorityLevel.MEDIUM.value
            }
        },
        "signer_type": SignerType.API_SIGNER.value
    }

    return submit_response

async def submit_erc20_to_erc20_quote(quote_id: str, vault_id: str, chain_type: str, origin_network: str, destination_network: str, sell_token_amount: str, sell_token_address:str, buy_token_address: str, providers: list, slippage: str) -> dict:
    print("Submitting ERC20 to ERC20 quote: ", quote_id)
    submit_response = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": AssetDetailType.ERC20.value,
            "token": {
                "chain": origin_network,
                "hex_repr": sell_token_address
            }
            }
        },
        "output_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": AssetDetailType.ERC20.value,
            "token": {
                "chain": destination_network,
                "hex_repr": buy_token_address
            }
            }
        },
        "amount": sell_token_amount,
        "slippage_bps": slippage,
        "fee": {
            "type": "evm",
            "details": {
                "type": GasType.PRIORITY.value,
                "priority_level": GasPriorityLevel.HIGH.value
            }
        },
        "signer_type": SignerType.API_SIGNER.value
    }

    return submit_response


async def submit_spl_to_spl_quote(quote_id: str, vault_id: str, chain_type: str, network: str, sell_token_amount: str, sell_token_address:str, buy_token_address: str, providers: list, slippage: str) -> dict:
    print("Submitting SPL to SPL quote: ", quote_id)
    submit_response = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": AssetDetailType.SPL_TOKEN.value,
            "token": {
                "chain": network,
                "base58_repr": sell_token_address
            }
            }
        },
        "output_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": AssetDetailType.SPL_TOKEN.value,
            "token": {
                "chain": network,
                "base58_repr": buy_token_address
            }
            }
        },
        "amount": sell_token_amount,
        "slippage_bps": slippage,
        "signer_type": SignerType.API_SIGNER.value
    }

    return submit_response