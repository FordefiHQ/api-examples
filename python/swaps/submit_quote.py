async def submit_quote(quote_id: str, vault_id: str, chain_type: str, network: str,  sell_token_amount: str, buy_token_address: str, providers: list, slippage: str, access_token: str):
    print(f"Getting quote from: {providers}")
    submit_response = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "native",
            "chain": f"evm_{network}"
            }
        },
        "output_asset_identifier": {
            "type": chain_type,
            "details": {
            "type": "erc20",
            "token": {
                "chain": f"evm_{network}",
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
    # submit_response = {
    #     "signer_type": "api_signer",
    #     "type": "evm_transaction",
    #     "details": {
    #         "type": chain_type,
    #         "quote": quote_id,
    #         "input_asset_identifier": {
    #             "type": chain_type,
    #             "details": {
    #                 "type": "native",
    #                 "chain": network
    #             }
    #         },
    #         "output_asset_identifier": {
    #             "type": chain_type,
    #             "details": {
    #                 "type": "erc20",
    #                 "token": {
    #                     "chain": network,
    #                     "hex_repr": buy_token_address
    #                 }
    #             }
    #         },
    #         "amount": sell_token_amount,
    #         "slippage_bps": slippage,
    #         "gas": {
    #             "type": "priority",
    #             "priority_level": "medium"
    #         },
    #         "requested_provider_ids": providers
    #     },
    #     "vault_id": vault_id
    # }
    # print(submit_response)

    return submit_response