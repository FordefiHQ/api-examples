import lighter
import asyncio

async def build_tx():
    client = lighter.ApiClient()
    try:
        account_api = lighter.AccountApi(client)
        account = await account_api.account(by="index", value="1")
        print(account)
    finally:
        await client.close()  # Make sure connection is cleanly closed
    return "connected!"