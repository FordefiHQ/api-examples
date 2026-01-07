async def submit_native_to_erc20_quote(quote_id: str, vault_id: str, chain_type: str, network: str,  sell_token_amount: str, buy_token_address: str, providers: list, slippage: str) -> dict:
    print("Submitting Native to ERC20 quote: ", quote_id)
    submit_response = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "native",
            "chain": network
            }
        },
        "output_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "erc20",
            "token": {
                "chain": network,
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
                "type": "priority",
                "priority_level": "medium"
            }
        },
        "signer_type": "api_signer"
    }

    return submit_response

async def submit_erc20_to_erc20_quote(quote_id: str, vault_id: str, chain_type: str, network: str,  sell_token_amount: str, sell_token_address:str, buy_token_address: str, providers: list, slippage: str) -> dict:
    print("Submitting ERC20 to ERC20 quote: ", quote_id)
    submit_response = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "erc20",
            "token": {
                "chain": network,
                "hex_repr": sell_token_address
            }
            }
        },
        "output_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "erc20",
            "token": {
                "chain": network,
                "hex_repr": buy_token_address
            }
            }
        },
        "amount": sell_token_amount,
        "slippage_bps": slippage,
        "fee": {
            "type": "evm",
            "details": {
                "type": "priority",
                "priority_level": "high"
            }
        },
        "signer_type": "api_signer"
    }

    return submit_response


async def submit_spl_to_spl_quote(quote_id: str, vault_id: str, chain_type: str, network: str,  sell_token_amount: str, sell_token_address:str, buy_token_address: str, providers: list, slippage: str) -> dict:
    print("Submitting SPL to SPL quote: ", quote_id)
    submit_response = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "spl_token",
            "token": {
                "chain": network,
                "base58_repr": sell_token_address
            }
            }
        },
        "output_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "spl_token",
            "token": {
                "chain": network,
                "base58_repr": buy_token_address
            }
            }
        },
        "amount": sell_token_amount,
        "slippage_bps": slippage,
        "signer_type": "api_signer"
    }

    return submit_response