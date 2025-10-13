import os
import json
import time
import ecdsa
import base64
import hashlib
import requests
import subprocess
from typing import Dict
from http import HTTPStatus
from dotenv import load_dotenv
from ecdsa.util import sigdecode_der
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

load_dotenv()
VALIDATOR_BOT_TOKEN = os.getenv("VALIDATOR_BOT_TOKEN")
ORIGIN_VAULT = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73" # Change to your Vault's address
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
with open('./public_key.pem', "r") as f:
    FORDEFI_PUBLIC_KEY = f.read()

signature_pub_key = ecdsa.VerifyingKey.from_pem(FORDEFI_PUBLIC_KEY)

class TransactionAbortError(Exception):
    """Raised when a transaction should be aborted"""
    pass


def verify_signature(signature: str, body: bytes) -> bool:
    """Verify webhook signature using ECDSA"""
    try:
        return signature_pub_key.verify(
            signature=base64.b64decode(signature),
            data=body,
            hashfunc=hashlib.sha256,
            sigdecode=sigdecode_der,
        )
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False


def get_transaction_data(transaction_id: str) -> Dict:
    """Fetch transaction data from Fordefi API"""
    url = f"https://api.fordefi.com/api/v1/transactions/{transaction_id}"
    headers = {"Authorization": f"Bearer {VALIDATOR_BOT_TOKEN}"}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching transaction data: {e}")
        return {}


def wait_for_transaction_creation(transaction_id: str, max_wait_time: int = 300) -> Dict:
    """Poll until transaction is created and ready for validation"""
    target_states = ["waiting_for_approval"]
    terminal_states = ["aborted", "completed", "approved", "stuck", "mined"]
    start_time = time.time()
    poll_interval = 5
    
    print(f"🕐 Waiting for transaction {transaction_id} to be created...")
    
    while time.time() - start_time < max_wait_time:
        transaction_data = get_transaction_data(transaction_id)
        
        if not transaction_data:
            print("Failed to fetch transaction data, retrying...")
            time.sleep(poll_interval)
            continue
            
        current_state = transaction_data.get("state")
        print(f"Current transaction state: {current_state}")
        
        if current_state in terminal_states:
            print(f"ℹ️ Transaction is already in a terminal state: {current_state}")
            return transaction_data
        
        if current_state in target_states:
            print(f"✅ Transaction is now in created state: {current_state}")
            return transaction_data
            
        print(f"Transaction not yet created, waiting {poll_interval}s...")
        time.sleep(poll_interval)
    
    print(f"⏰ Timeout: Transaction did not reach created state within {max_wait_time} seconds")
    return {}


def abort_transaction(transaction_id: str, reason: str) -> None:
    """Abort a transaction with the given reason"""
    transaction_data = get_transaction_data(transaction_id)
    if transaction_data.get("state") == "aborted":
        print(f"ℹ️ Transaction {transaction_id} is already aborted. No action needed.")
        return

    url = f"https://api.fordefi.com/api/v1/transactions/{transaction_id}/abort"
    headers = {"Authorization": f"Bearer {VALIDATOR_BOT_TOKEN}"}

    try:
        response = requests.post(url, headers=headers)
        response.raise_for_status()
        print(f"🪓🪓 Transaction aborted: {reason}")
    except requests.exceptions.RequestException as e:
        # Get more details about the error response
        response_details = ""
        request_id = ""
        
        if hasattr(e, 'response') and e.response is not None:
            response_details = f"Status: {e.response.status_code}"
            
            # Try to get request ID from headers
            if 'x-request-id' in e.response.headers:
                request_id = e.response.headers['x-request-id']
                response_details += f", Request ID: {request_id}"
            
            # Try to get response body for more context
            try:
                response_body = e.response.text
                if response_body:
                    response_details += f", Response: {response_body}"
            except:
                pass
        
        error_message = f"❌ Error aborting transaction: {e}"
        if response_details:
            error_message += f" ({response_details})"
        print(error_message)
        
        # Check if this is a 400 error - might be expected (already aborted)
        if hasattr(e, 'response') and e.response is not None and e.response.status_code == 400:
            print("⚠️ Got 400 error - transaction might already be aborted or in invalid state")
            return
        
        # For other errors, still raise 500
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Failed to abort transaction: {reason}. {response_details}"
        )


def validate_eip_712_order(transaction_data: Dict) -> None:
    """Validate EIP-712 orders"""
    print("🔍 Validating EIP-712 order...")
    raw_data = transaction_data.get("raw_data")
    if not raw_data:
        print("ℹ️ No raw_data found, skipping EIP-712 validation")
        return
        
    print(f"🔍 Raw data type: {type(raw_data)}")
    print(f"🔍 Raw data preview: {str(raw_data)[:200]}...")
        
    try:
        if isinstance(raw_data, str):
            parsed_data = json.loads(raw_data)
            print(f"🔍 Parsed data keys: {list(parsed_data.keys())}")
            
            message = parsed_data.get("message", {})
            print(f"🔍 Message keys: {list(message.keys()) if message else 'No message found'}")
            
            receiver = message.get("receiver", "").lower()
            
            if not receiver:
                print("ℹ️ No receiver found in message, skipping receiver validation")
                return
                
            print(f"🔍 Order receiver: {receiver}")
            print(f"🔍 ORIGIN_VAULT: {ORIGIN_VAULT.lower()}")
            print(f"🔍 ZERO_ADDRESS: {ZERO_ADDRESS}")
            
            # Allow zero address (valid) or ORIGIN_VAULT
            if receiver == ZERO_ADDRESS:
                print("✅ Receiver is zero address - considered valid")
            elif receiver == ORIGIN_VAULT.lower():
                print(f"✅ Receiver matches ORIGIN_VAULT")
            else:
                print(f"❌ Unauthorized receiver found: {receiver}")
                raise TransactionAbortError(f"Unauthorized receiver: {receiver}")
                
    except json.JSONDecodeError as e:
        print(f"⚠️ raw_data is not valid JSON: {e}")
    except TransactionAbortError:
        raise
    except Exception as e:
        print(f"⚠️ Error parsing raw_data: {e}")
        print(f"🔍 Exception type: {type(e).__name__}")


def validate_hex_data(transaction_data: Dict) -> None:
    """Validate hex data contains ORIGIN_VAULT"""
    print("🔍 Validating hex data...")
    hex_data = transaction_data.get("hex_data")
    if not hex_data:
        print("ℹ️ No hex_data found, skipping hex data validation")
        return
        
    print(f"🔍 Hex data: {hex_data[:100]}...")
    
    # Skip validation for approval transactions
    parsed_data = transaction_data.get("parsed_data", {})
    contract_method = parsed_data.get("method")
    print(f"🔍 Contract method: {contract_method}")
    print(f"🔍 Parsed data keys: {list(parsed_data.keys()) if parsed_data else 'No parsed data'}")
    
    if contract_method == "approve":
        print("ℹ️ This is an approval transaction, skipping hex data validation")
        return
        
    try:
        print("🔍 Attempting to decode hex data with cast...")
        # Decode using cast
        result = subprocess.run(
            ["cast", "4byte-decode", hex_data], 
            capture_output=True, 
            text=True
        )
        decoded_output = result.stdout or ""
        decoded_error = result.stderr or ""
        
        print(f"🔎 Cast return code: {result.returncode}")
        print(f"🔎 Decoded function signature: {decoded_output}")
        if decoded_error:
            print(f"🔎 Cast stderr: {decoded_error}")
        
        if ORIGIN_VAULT.lower() not in decoded_output.lower():
            print(f"❌ ORIGIN_VAULT ({ORIGIN_VAULT.lower()}) not found in decoded data")
            print(f"🔍 Searching for ORIGIN_VAULT in: {decoded_output.lower()}")
            raise TransactionAbortError("ORIGIN_VAULT not found in decoded data")
        else:
            print(f"✅ ORIGIN_VAULT found in decoded data")
            
    except subprocess.SubprocessError as e:
        print(f"❌ Subprocess error when decoding hex data: {e}")
        raise TransactionAbortError(f"Unable to decode hex data: {e}")
    except Exception as e:
        print(f"❌ Unexpected error in hex data validation: {e}")
        print(f"🔍 Exception type: {type(e).__name__}")
        raise TransactionAbortError(f"Error validating hex data: {e}")

def approve_transaction(transaction_id: str, access_token: str) -> None:
    """Approve a transaction"""
    url = f"https://api.fordefi.com/api/v1/transactions/{transaction_id}/approve"
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        response = requests.post(url, headers=headers)
        response.raise_for_status()
        print(f"✅ Transaction approved successfully")
    except requests.exceptions.RequestException as e:
        # Get more details about the error response
        response_details = ""
        request_id = ""
        
        if hasattr(e, 'response') and e.response is not None:
            response_details = f"Status: {e.response.status_code}"
            
            # Try to get request ID from headers
            if 'x-request-id' in e.response.headers:
                request_id = e.response.headers['x-request-id']
                response_details += f", Request ID: {request_id}"
            
            # Try to get response body for more context
            try:
                response_body = e.response.text
                if response_body:
                    response_details += f", Response: {response_body}"
            except:
                pass
        
        error_message = f"❌ Error approving transaction: {e}"
        if response_details:
            error_message += f" ({response_details})"
        print(error_message)
        
        # Check if this is a 400 error - might be expected (already approved or in invalid state)
        if hasattr(e, 'response') and e.response is not None and e.response.status_code == 400:
            print("⚠️ Got 400 error - transaction might already be approved or in invalid state")
            # Don't raise HTTP 500 for 400 errors - just log and continue
            return
        
        # For other errors, still raise 500
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve transaction. {response_details}"
        )

def validate_transaction(transaction_data: Dict, transaction_id) -> None:
    """Run all transaction validations"""
    print("🔍 Starting transaction validation...")
    print(f"🔍 Transaction ID: {transaction_id}")
    print(f"🔍 Transaction keys: {list(transaction_data.keys())}")
    
    # Log key transaction details
    print(f"🔍 From: {transaction_data.get('from', {}).get('address', 'unknown')}")
    print(f"🔍 To: {transaction_data.get('to', {}).get('address', 'unknown')}")
    print(f"🔍 Value: {transaction_data.get('value', 'unknown')}")
    print(f"🔍 Chain: {transaction_data.get('chain', {}).get('name', 'unknown')}")
    
    # Validate EIP-712 orders (CoWSwap, 1inch)
    print("🔍 Starting EIP-712 validation...")
    validate_eip_712_order(transaction_data)
    print("✅ EIP-712 validation completed")
    
    # Validate hex data
    print("🔍 Starting hex data validation...")
    validate_hex_data(transaction_data)
    print("✅ Hex data validation completed")
    
    print("✅ All transaction validations passed")
    print("🔍 Approving transaction with Validator API User...")
    approve_transaction(transaction_id, VALIDATOR_BOT_TOKEN)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "online"}


@app.post("/")
async def fordefi_webhook(request: Request):
    """
    Fordefi webhook endpoint for monitoring transactions.
    
    Validates transactions to prevent unauthorized fund movements
    by checking receivers and ensuring ORIGIN_VAULT is present.
    """
    # Authenticate webhook is from Fordefi
    signature = request.headers.get("X-Signature")
    if not signature:
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Missing signature")

    raw_body = await request.body()
    if not verify_signature(signature, raw_body):
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Invalid signature")
    print("Fordefi ignature is verified ✍️✅")

    # Parse webhook data
    try:
        data = json.loads(raw_body)
        print(f"📝 Received webhook: {data['webhook_id']}")
        print(f"Event ID: {data['event_id']}")
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse webhook JSON: {e}")
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid JSON")

    event_data = data.get("event", {})
    transaction_data = event_data
    
    if not transaction_data or not transaction_data.get("id"):
        print("❌ No valid transaction data found in webhook")
        print(f"🔍 Available event data: {json.dumps(event_data, indent=2)[:500]}...")
        return {"message": "No valid transaction data found in webhook"}

    # Extract transaction ID for logging and API calls
    transaction_id = transaction_data.get("id")
    if not transaction_id:
        print("❌ No transaction ID found in transaction data")
        print(f"🔍 Transaction data keys: {list(transaction_data.keys())}")
        return {"message": "No transaction ID found in transaction data"}

    print(f"🔍 Processing transaction: {transaction_id}")
    print(f"🔍 Transaction type: {transaction_data.get('type', 'unknown')}")
    print(f"🔍 Transaction direction: {transaction_data.get('direction', 'unknown')}")

    # Check if transaction is in a state that requires validation
    state = transaction_data.get("state")
    print(f"Current transaction state: {state}")
    
    # Only validate transactions that are waiting for approval
    if state != "waiting_for_approval":
        if state in ["aborted", "completed", "approved", "stuck", "signed", "pushed_to_blockchain", "mined"]:
            message = f"Transaction {transaction_id} is in '{state}' state. No validation needed."
            print(f"ℹ️ {message}")
            return {"message": message}
        else:
            # For other states, we might want to wait or handle differently
            message = f"Transaction {transaction_id} is in '{state}' state. Skipping validation."
            print(f"⚠️ {message}")
            return {"message": message}

    # Validate transaction
    try:
        print("🚀 Starting transaction validation process...")
        validate_transaction(transaction_data, transaction_id)
        print("🎉 Transaction validation process completed successfully")
        return {"message": "Transaction validated successfully"}
        
    except TransactionAbortError as e:
        print(f"🚫 Transaction validation failed: {e}")
        print("🪓 Attempting to abort transaction...")
        abort_transaction(transaction_id, str(e))
        return {"message": f"Transaction aborted: {e}"}
    except Exception as e:
        print(f"💥 Unexpected error during validation: {e}")
        print(f"🔍 Exception type: {type(e).__name__}")
        print("🪓 Attempting to abort transaction due to unexpected error...")
        try:
            abort_transaction(transaction_id, f"Unexpected validation error: {e}")
        except Exception as abort_error:
            print(f"❌ Failed to abort transaction after error: {abort_error}")
        return {"message": f"Transaction validation failed with unexpected error: {e}"}

# uvicorn bot:app --host 0.0.0.0 --port 8080 --reload