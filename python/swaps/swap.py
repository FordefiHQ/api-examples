import os
import json
import asyncio
import datetime
from pathlib import Path
from dotenv import load_dotenv
from broadcast import broadcast_tx
from get_provider_list import getSwapProviders 
from sign_payload import sign_with_api_user_private_key
from submit_quote import submit_native_to_erc20_quote, submit_erc20_to_erc20_quote
from get_quote import get_native_to_erc20_quote, get_erc20_to_erc20_quote, get_best_quote

load_dotenv()

## CONFIG
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
FORDEFI_EVM_VAULT_ID = os.environ["FORDEFI_EVM_VAULT_ID"]
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
path = "/api/v1/swaps"
sell_token_amount = str(1000000000000000) # in smallest units or decimals
sell_token_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # USDC on Ethereum
buy_token_address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" # USDC on Arbitrum
chain_type = "evm"
origin_network = "evm_ethereum_mainnet"
destination_network = "evm_arbitrum_mainnet"
slippage = "500" # in bps
is_erc20_to_erc20_swap = False # to configure

async def main():
    try:
        # Getting list of providers
        provider_list  = await getSwapProviders(chain_type, USER_API_TOKEN)
        print("Providers: ", provider_list)
        
        if is_erc20_to_erc20_swap is True:
        # Getting quotes from providers
            quotes_response = await get_erc20_to_erc20_quote(
                vault_id=FORDEFI_EVM_VAULT_ID,
                chain_type=chain_type,
                origin_network=origin_network,
                destination_network=destination_network,
                sell_token_amount=sell_token_amount,
                sell_token_address=sell_token_address,
                buy_token_address=buy_token_address,
                providers=provider_list,
                slippage=slippage,
                access_token=USER_API_TOKEN)
        else:
            quotes_response = await get_native_to_erc20_quote(
                vault_id=FORDEFI_EVM_VAULT_ID,
                chain_type=chain_type,
                origin_network=origin_network,
                destination_network=destination_network,
                sell_token_amount=sell_token_amount,
                buy_token_address=buy_token_address,
                providers=provider_list,
                slippage=slippage,
                access_token=USER_API_TOKEN)
        
        if quotes_response.get("error"):
            print(f"❌ Error getting quotes: {quotes_response['details']}")
            return
        
        # Extracting the best quote
        best_quote = await get_best_quote(quotes_response)
        if not best_quote:
            print("❌ No valid quotes available")
            return
        
        print(f"Using quote ID: {best_quote['quote_id']} from {best_quote['provider_info']['provider_id']}")

        # Creating transaction payload using the best quote
        if is_erc20_to_erc20_swap is True:
            tx_payload = await submit_erc20_to_erc20_quote(
                quote_id=best_quote["quote_id"],
                vault_id=FORDEFI_EVM_VAULT_ID,
                chain_type=chain_type,
                origin_network=origin_network,
                destination_network=destination_network,
                sell_token_amount=sell_token_amount,
                sell_token_address=sell_token_address,
                buy_token_address=buy_token_address,
                providers=[best_quote["provider_info"]["provider_id"]],
                slippage=slippage)
        else:
            tx_payload = await submit_native_to_erc20_quote(
                quote_id=best_quote["quote_id"],
                vault_id=FORDEFI_EVM_VAULT_ID,
                chain_type=chain_type,
                origin_network=origin_network,
                destination_network=destination_network,
                sell_token_amount=sell_token_amount,
                buy_token_address=buy_token_address,
                providers=[best_quote["provider_info"]["provider_id"]],
                slippage=slippage)

        tx_payload_json = json.dumps(tx_payload) 
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{tx_payload_json}"

        ## Signing transaction payload with API User's private key  
        signature = await sign_with_api_user_private_key(payload=payload, api_user_private_key=PRIVATE_KEY_PEM_FILE)

        ## Sending transaction to Fordefi for MPC signature and broadcast
        print("Making API request to Fordefi for MPC signature 📡")
        res = await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, tx_payload_json)
        print("Request ID: ", res.headers['x-request-id'])
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())