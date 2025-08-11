import requests

async def getSwapProviders(chain_type: str, access_token: str ) -> list :
        print(f"Checking providers for {chain_type} chain")
        provider_list = requests.get(
            f"https://api.fordefi.com/api/v1/swaps/provider-ids/{chain_type}",
            headers={
                "Authorization": f"Bearer {access_token}",
            }
        )
        providers = provider_list.json()
        provider_ids = providers['provider_ids'] 
        return provider_ids