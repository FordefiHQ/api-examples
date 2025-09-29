import sys
import json
import asyncio
import datetime
from sign_payload import sign
from broadcast import broadcast_tx
from config import hyperliquid_config, API_ENDPOINT, API_USER_ACCESS_TOKEN, API_USER_PRIVATE_KEY
# from hl_withdraw import withdraw3
# from hl_send_usdc import usd_send
# from hl_deposit import deposit
# from hl_vault_transfer import vault_transfer

async def main():
    try:
        # if hyperliquid_config['action'] == "deposit":
        #     await deposit(hyperliquid_config)
        # elif hyperliquid_config['action'] == "withdraw":
        #     await withdraw3(hyperliquid_config)
        # elif hyperliquid_config['action'] == "vault_transfer":
        #     await vault_transfer(hyperliquid_config)
        # else:
        #     await usd_send(hyperliquid_config)
        
        ## Building transaction payload
        request_json = {

        }
        request_body = json.dumps(request_json)
        timestamp = datetime.datetime.now().strftime("%s")
        payload = f"{API_ENDPOINT}|{timestamp}|{request_body}"

        ## Signing transaction payload with API User's private key
        signature = await sign(payload=payload, private_key_path=API_USER_PRIVATE_KEY)

        ## Broadcasting signed payload to Fordefi
        await broadcast_tx(API_ENDPOINT, API_USER_ACCESS_TOKEN, signature, timestamp, request_body)
        print("✅ Transaction submitted successfully!")


    except Exception as e:
        print(f"❌ Transaction failed: {str(e)}")

    except Exception as error:
        print(f"Oops, an error occurred: {error}", file=sys.stderr)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        print(f"Unhandled error: {error}", file=sys.stderr)
        sys.exit(1)