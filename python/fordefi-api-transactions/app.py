import os
import json
import datetime
from dotenv import load_dotenv
from api_requests.broadcast import broadcast_tx
from signing.signer import sign
from utils.tx_processor import process_transaction

load_dotenv()

## User interface

vault_id = input("👋 Welcome! Please enter your vault ID (or press enter to use the default Vault): ").strip().lower() or "default"
destination =  input("🚚 Sounds good! What's the destination address? (or press enter to use the default destination address): ").strip() or "default"

evm_chain = None
token = None
while True:
    ecosystem = input("🌐 Great! On which network should we broadcast the transaction? (SOL/EVM/SUI/TON/APT/BTC): ").strip().lower()
    if ecosystem == "evm":
        evm_chain =  input("🌐 Which EVM chain? ").strip().lower() or "ethereum"
        if evm_chain in ["arbitrum", "optimism", "ethereum", "bsc"]:
            break
        else:
            print("❌ Invalid input. Please choose Arbitrum, Optimism, Ethereum, Bsc")              
    elif ecosystem in ["sol", "sui", "ton", "apt", "btc"]:
        break
    else:
        print("❌ Invalid input. Please choose SOL, EVM, SUI, TON, APT, BTC")

token = input("🪙 What is the token ticker? If not a token press return: ").strip().lower() or None

value =  input("💸 Ok! How much would you like to spend? ").strip().lower()

custom_note = input("🗒️  Would you like to add a note? ").strip().lower() or "note!"
        
print(f"🚀 Excellent! Sending from vault {vault_id} to {destination} on {ecosystem.upper()} -> {evm_chain}.")

## Building transaction

request_json = process_transaction(ecosystem, evm_chain, vault_id, destination, value, custom_note, token)

# OPTIONAL -> Save request JSON to file (for debugging)
# timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
# filename = f"transaction_request_{timestamp_str}.json"
# with open(filename, 'w') as f:
#     json.dump(request_json, f, indent=2)
# print(f"📄 Tx JSON saved to {filename}")

## Broadcast transaction

access_token = os.getenv("FORDEFI_API_TOKEN")
request_body = json.dumps(request_json)
path = "/api/v1/transactions"
timestamp = datetime.datetime.now().strftime("%s")
payload = f"{path}|{timestamp}|{request_body}"

signature = sign(payload=payload)

try:
    resp_tx = broadcast_tx(path, access_token, signature, timestamp, request_body)
    print("✅ Transaction submitted successfully!")
    print(f"Transaction ID: {resp_tx.json().get('id', 'N/A')}")
    
except RuntimeError as e:
    print(f"❌ {str(e)}")
    exit(1)
except json.JSONDecodeError as e:
    print(f"❌ Failed to parse response: {str(e)}")
    print(f"Raw response: {resp_tx.text}")
    exit(1)