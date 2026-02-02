import os
import json
import asyncio
import datetime
from pathlib import Path
from dotenv import load_dotenv
from broadcast import broadcast_tx
from get_provider_list import getSwapProviders
from sign_payload import sign_with_api_user_private_key
from submit_quote import submit_spl_to_spl_quote
from get_quote import get_spl_to_spl_quote, get_best_quote

load_dotenv()

## CONFIG
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
FORDEFI_SOLANA_VAULT_ID = os.environ["FORDEFI_SOLANA_VAULT_ID"]
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
path = "/api/v1/swaps"
sell_token_amount = str(100_00) # in smallest units or decimals
sell_token_address = "So11111111111111111111111111111111111111112" # Wrapped SOL (wSOL) - use this for SOL swaps
buy_token_address = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" # USDT on Solana
chain_type = "solana"
network = "solana_mainnet"
slippage = "500" # in bps

# Note: Solana swaps always use SPL tokens. For SOL, use wrapped SOL (wSOL) address above.

async def main():
    try:
        # Getting list of providers
        provider_list  = await getSwapProviders(chain_type, USER_API_TOKEN)
        print("Providers: ", provider_list)

        # Getting quotes from providers (always SPL to SPL on Solana)
        quotes_response = await get_spl_to_spl_quote(
            vault_id=FORDEFI_SOLANA_VAULT_ID,
            chain_type=chain_type,
            network=network,
            sell_token_amount=sell_token_amount,
            sell_token_address=sell_token_address,
            buy_token_address=buy_token_address,
            providers=provider_list,
            slippage=slippage,
            access_token=USER_API_TOKEN)

        if quotes_response.get("error"):
            print(f"Error getting quotes: {quotes_response['details']}")
            return

        # Extracting the best quote
        best_quote = await get_best_quote(quotes_response)
        if not best_quote:
            print("No valid quotes available")
            return

        print(f"Using quote ID: {best_quote['quote_id']} from {best_quote['provider_info']['provider_id']}")

        # Creating transaction payload using the best quote
        tx_payload = await submit_spl_to_spl_quote(
            quote_id=best_quote["quote_id"],
            vault_id=FORDEFI_SOLANA_VAULT_ID,
            chain_type=chain_type,
            network=network,
            sell_token_amount=sell_token_amount,
            sell_token_address=sell_token_address,
            buy_token_address=buy_token_address,
            providers=[best_quote["provider_info"]["provider_id"]],
            slippage=slippage)

        tx_payload_json = json.dumps(tx_payload) 
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
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