import os
import json
import asyncio
import datetime
from get_quote import get_quote, get_best_quote
from submit_quote import submit_quote
from get_provider_list import getSwapProviders 
from pathlib import Path
from sign_payload import sign
from dotenv import load_dotenv
from broadcast import broadcast_tx

load_dotenv()

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
FOREFI_VAULT_ID = os.getenv("FOREFI_VAULT_ID")
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
path = "/api/v1/swaps"
sell_token_amount = str(1000000000000000) # in smallest unit, 1 ETH = 1000000000000000000 wei
buy_token_address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" # USDC on Ethereum
chain_type =  "evm"
network =  "evm_ethereum_mainnet"
slippage = "500" # in bps

async def main():
    try:
        # Getting list of providers
        provider_list  = await getSwapProviders(chain_type, USER_API_TOKEN)
        print(provider_list)
        
        # Getting quotes from providers
        quotes_response = await get_quote(
            vault_id=FOREFI_VAULT_ID, 
            chain_type=chain_type, 
            network=network, 
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
        
        print(f"Using quote ID: {best_quote['quote_id']} from {best_quote['provider_id']}")

        # Creating transaction payload using the best quote
        tx_payload = await submit_quote(
            quote_id=best_quote["quote_id"],
            vault_id=FOREFI_VAULT_ID, 
            chain_type=chain_type, 
            network=network, 
            sell_token_amount=sell_token_amount, 
            buy_token_address=buy_token_address, 
            providers=[best_quote["provider_id"]],
            slippage=slippage)
        
        tx_payload_json = json.dumps(tx_payload) 
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{path}|{timestamp}|{tx_payload_json}"

        ## Signing transaction payload with API User's private key  
        signature = await sign(payload=payload, private_key_path=PRIVATE_KEY_PEM_FILE)

        ## Sending transaction to Fordefi for MPC signature and broadcast
        await broadcast_tx(path, USER_API_TOKEN, signature, timestamp, tx_payload_json)
        print("✅ Transaction submitted successfully!")
    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())