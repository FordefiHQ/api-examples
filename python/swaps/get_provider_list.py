import requests

async def getSwapProviders(chain_type: str, access_token: str ) -> list :
    print(f"Checking providers for {chain_type} chain")
    provider_list = requests.get(
        f"https://api.fordefi.com/api/v1/swaps/providers/{chain_type}",
        headers={
            "Authorization": f"Bearer {access_token}",
        }
    )
    providers = provider_list.json()
    provider_ids = []
    for provider in providers["providers"]:
        prov = provider["provider_id"]
        provider_ids.append(prov)

    return provider_ids