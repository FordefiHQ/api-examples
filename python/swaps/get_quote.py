import requests
from typing import Dict, Any, Optional

async def get_best_quote(quotes_response: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if "providers_with_quote" not in quotes_response:
        return None
    
    valid_quotes = []
    
    for provider in quotes_response["providers_with_quote"]:
        if provider.get("quote") is not None and provider.get("api_error") is None:
            valid_quotes.append(provider)
            provider_id = provider['provider_info']['provider_id']
            print(f"✅ {provider_id}: {provider['quote']['output_amount']} tokens")
        else:
            error_msg = provider.get("api_error", {}).get("description", "Unknown error")
            provider_id = provider['provider_info']['provider_id']
            print(f"❌ {provider_id}: {error_msg}")
    
    if not valid_quotes:
        print("No valid quotes found from any provider")
        return None
    
    best_quote = max(valid_quotes, key=lambda x: int(x["quote"]["output_amount"]))
    
    provider_id = best_quote['provider_info']['provider_id']
    print(f"🏆 Best quote from {provider_id}: {best_quote['quote']['output_amount']} tokens")
    
    # Return both quote and provider info
    return {
        **best_quote["quote"],
        "provider_info": best_quote["provider_info"]
    }

async def get_native_to_erc20_quote(vault_id: str, chain_type: str, network: str,  sell_token_amount: str, buy_token_address: str, providers: list, slippage: str, access_token: str) -> Dict[str, Any]:
    print(f"Getting Native to ERC20 quote from: {providers}")
    quote_data = {
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
      "signer_type": "api_signer",
      "requested_provider_ids": providers
    }

    try:
        quote = requests.post(
          "https://api.fordefi.com/api/v1/swaps/quotes",
          headers={
              "Authorization": f"Bearer {access_token}",
          },
          json=quote_data
        )

        print("Request headers: ", quote.headers)
        if quote.status_code >= 400:
            try:
                error_response = quote.json()
                return {"error": True, "details": error_response}
            except ValueError:
                return {"error": True, "details": {"message": quote.text}}
        
        return quote.json()
        
    except requests.exceptions.RequestException as e:
        print(f"Error making quote request: {e}")
        raise
    except ValueError as e:
        print(f"Error parsing JSON response: {e}")
        raise

async def get_erc20_to_erc20_quote(vault_id: str, chain_type: str, network: str,  sell_token_amount: str, buy_token_address: str, sell_token_address: str, providers: list, slippage: str, access_token: str) -> Dict[str, Any]:
    print(f"Getting ERC20 to ERC20 quote from: {providers}")
    quote_data = {
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
      "signer_type": "api_signer",
      "requested_provider_ids": providers
    }

    try:
        quote = requests.post(
          "https://api.fordefi.com/api/v1/swaps/quotes",
          headers={
              "Authorization": f"Bearer {access_token}",
          },
          json=quote_data
        )

        print("Request headers: ", quote.headers)
        if quote.status_code >= 400:
            try:
                error_response = quote.json()
                return {"error": True, "details": error_response}
            except ValueError:
                return {"error": True, "details": {"message": quote.text}}
        
        return quote.json()
        
    except requests.exceptions.RequestException as e:
        print(f"Error making quote request: {e}")
        raise
    except ValueError as e:
        print(f"Error parsing JSON response: {e}")
        raise