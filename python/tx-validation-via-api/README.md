# Approve Transactions via API

A webhook-based validator bot. Validates and automatically approves or aborts transactions based on security rules.

## Overview

This bot acts as an automated transaction validator that:
1. Receives webhook notifications from Fordefi
2. Validates transactions against security rules
3. Automatically approves valid transactions
4. Aborts unauthorized or suspicious transactions

## Features

- **ECDSA Signature Verification**: Validates webhook authenticity using Fordefi's public key
- **EIP-712 Order Validation**: Validates structured data for DEX orders (CoWSwap, 1inch, etc.)
- **Hex Data Validation**: Decodes and validates transaction calldata using Foundry's `cast`
- **Automatic Approval/Abort**: Takes immediate action based on validation results
- **Health Check Endpoint**: Monitor bot status via `/health`
- **Detailed Logging**: Comprehensive logging with emoji indicators for easy debugging

## Prerequisites

- Python 3.8 or higher
- Foundry installed (specifically the `cast` tool)
- Fordefi API access tokens
- Fordefi public key PEM file

## Installation

### 1. Install Python Dependencies

```bash
pip install fastapi uvicorn requests python-dotenv ecdsa
```

Or using uv:
```bash
uv sync
```

### 2. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
VALIDATOR_BOT_TOKEN=your_validator_bot_token_here
FORDEFI_PUBLIC_KEY_PATH=/path/to/public_key.pem
```

### 4. Update Origin Vault Address

Edit [bot.py:15](bot.py#L15) to set your vault address:

```python
ORIGIN_VAULT = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73"  # Change to your Vault's address
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VALIDATOR_BOT_TOKEN` | Fordefi API token for transaction validation and approval | Yes |
| `FORDEFI_PUBLIC_KEY_PATH` | Path to Fordefi's public key PEM file | Yes |

### Security Constants

- **ORIGIN_VAULT**: Your authorized vault address that should receive funds
- **ZERO_ADDRESS**: Ethereum zero address (valid receiver for some DEX orders)

## Usage

### Starting the Bot

Development mode (with auto-reload):
```bash
uvicorn bot:app --host 0.0.0.0 --port 8080 --reload
```

Production mode:
```bash
uvicorn bot:app --host 0.0.0.0 --port 8080
```

### Exposing for Testing (using ngrok)

```bash
ngrok http 8080
```

Then configure your Fordefi webhook URL to point to the ngrok URL.

## API Endpoints

### POST `/`

Main webhook endpoint that receives Fordefi transaction notifications.

**Authentication**: Requires valid `X-Signature` header with ECDSA signature

**Request Body Example**:
```json
{
  "webhook_id": "wh_123456",
  "event_id": "evt_789012",
  "event": {
    "id": "tx_345678",
    "state": "waiting_for_approval",
    "type": "evm_transaction",
    "from": {"address": "0x..."},
    "to": {"address": "0x..."},
    "value": "1000000000000000000",
    "chain": {"name": "ethereum"},
    "raw_data": "{...}",
    "hex_data": "0x...",
    "parsed_data": {"method": "transfer"}
  }
}
```

**Responses**:
- `200 OK`: Transaction validated and approved/aborted
- `400 Bad Request`: Invalid JSON payload
- `401 Unauthorized`: Missing or invalid signature

### GET `/health`

Health check endpoint to verify the bot is running.

**Response**:
```json
{
  "status": "online"
}
```

## Transaction Validation Flow

```
Webhook Received
      ↓
Signature Verification
      ↓
Parse Webhook Data
      ↓
Check Transaction State
      ↓
[if waiting_for_approval]
      ↓
Validate EIP-712 Order
      ↓
Validate Hex Data
      ↓
All Validations Pass?
   ↓         ↓
  YES        NO
   ↓         ↓
Approve    Abort
```

## Security Validations

### 1. EIP-712 Order Validation

For transactions with `raw_data` field (typically DEX orders):

- Parses the EIP-712 structured data
- Extracts the `receiver` field from the message
- Validates receiver is either:
  - `0x0000000000000000000000000000000000000000` (zero address)
  - Your configured `ORIGIN_VAULT` address
- Aborts transaction if receiver is unauthorized

**Why?** Prevents DEX orders from sending funds to unauthorized addresses.

### 2. Hex Data Validation

For transactions with `hex_data` field:

- Decodes the calldata using Foundry's `cast 4byte-decode`
- Checks if `ORIGIN_VAULT` address appears in decoded data
- Skips validation for `approve()` transactions
- Aborts transaction if vault address not found

**Why?** Ensures that complex contract interactions involve your authorized vault.

## Transaction States

The bot handles different transaction states:

| State | Action |
|-------|--------|
| `waiting_for_approval` | Validates and approves/aborts |
| `aborted` | Skipped (already terminated) |
| `completed` | Skipped (already terminated) |
| `approved` | Skipped (already approved) |
| `stuck` | Skipped (terminal state) |
| `signed` | Skipped (already signed) |
| `pushed_to_blockchain` | Skipped (already on-chain) |
| `mined` | Skipped (confirmed on-chain) |
| Other states | Logged and skipped |


## Key Functions

### `verify_signature(signature: str, body: bytes) -> bool`
Verifies webhook ECDSA signature using Fordefi's public key.

### `get_transaction_data(transaction_id: str) -> Dict`
Fetches full transaction data from Fordefi API.

### `validate_eip_712_order(transaction_data: Dict) -> None`
Validates EIP-712 structured data for DEX orders. Raises `TransactionAbortError` if invalid.

### `validate_hex_data(transaction_data: Dict) -> None`
Decodes and validates transaction calldata. Raises `TransactionAbortError` if invalid.

### `approve_transaction(transaction_id: str, access_token: str) -> None`
Approves a transaction via Fordefi API.

### `abort_transaction(transaction_id: str, reason: str) -> None`
Aborts a transaction with a specific reason.

### `validate_transaction(transaction_data: Dict, transaction_id: str) -> None`
Orchestrates all validations and approves if all pass.

## Troubleshooting

### Issue: `cast: command not found`

**Solution**: Install Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Issue: Signature verification fails

**Solutions**:
- Verify `FORDEFI_PUBLIC_KEY_PATH` is correct
- Check that the PEM file format is valid
- Ensure the public key matches your Fordefi organization

### Issue: EIP-712 validation not working

**Solutions**:
- Verify `raw_data` field exists in webhook
- Check that `raw_data` is valid JSON
- Ensure the structured data has a `message.receiver` field

## Development

### Project Structure

```
tx-validation-via-api/
├── bot.py       # Main application
├── README.md                # General documentation
├── .env                     # Environment variables (not in repo)
├── public_key.pem          # Fordefi public key (not in repo)
├── requirements.txt         # Python dependencies
└── pyproject.toml          # Project metadata
```

### Testing Locally

1. Start the bot locally
2. Use ngrok to expose your local server
3. Configure Fordefi webhook to point to ngrok URL
4. Create test transactions in Fordefi
5. Monitor logs for validation flow