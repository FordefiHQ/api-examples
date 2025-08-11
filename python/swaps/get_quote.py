import requests

async def get_quote(vault_id: str, chain_type: str, network: str,  sell_token_amount: str, buy_token_address: str, providers: list, slippage: str, access_token: str):
    print(f"Getting quote from: {providers}")
    quote_data = {
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
      "signer_type": "api_signer",
      "requested_provider_ids": providers
    }

    quote = requests.post(
      "https://api.fordefi.com/api/v1/swaps/quotes",
      headers={
          "Authorization": f"Bearer {access_token}",
      },
      json=quote_data
    )

    return quote.json()