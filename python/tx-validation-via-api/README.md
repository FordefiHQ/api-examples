# Fordefi Transaction Validator Bot

A FastAPI webhook server that validates and auto-approves Fordefi transactions based on security rules.

## Overview

This bot monitors Fordefi webhook events and validates transactions to prevent unauthorized fund movements by:
- Validating EIP-712 order receivers (CoWSwap, 1inch, etc.)
- Checking transaction calldata for authorized vault addresses
- Automatically approving valid transactions or aborting suspicious ones

## Prerequisites

- Python 3.8+
- [Foundry](https://getfoundry.sh/) (for the `cast` command)
- Fordefi API access token

## Installation

### Python Dependencies

```bash
pip install fastapi uvicorn requests python-dotenv ecdsa
```

Or using uv:
```bash
uv sync
```

### Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Configuration

Create a `.env` file:

```env
VALIDATOR_BOT_TOKEN=your_fordefi_api_token
FORDEFI_PUBLIC_KEY_PATH=/path/to/fordefi_public_key.pem
ORIGIN_VAULT=0xYourVaultAddress
```

| Variable | Description |
|----------|-------------|
| `VALIDATOR_BOT_TOKEN` | Fordefi API token for validation and approval |
| `FORDEFI_PUBLIC_KEY_PATH` | Path to Fordefi's public key PEM file |
| `ORIGIN_VAULT` | Your authorized vault address |

## Usage

### Start the Server

Development:
```bash
uvicorn bot:app --host 0.0.0.0 --port 8080 --reload
```

Production:
```bash
uvicorn bot:app --host 0.0.0.0 --port 8080
```

### Expose for Testing (ngrok)

```bash
ngrok http 8080
```

Configure your Fordefi webhook URL to the ngrok endpoint.

## API Endpoints

### POST `/`

Main webhook endpoint for Fordefi transaction events.

**Headers:**
- `X-Signature`: ECDSA signature for authentication

**Response:**
- `200`: Transaction processed (approved or aborted)
- `400`: Invalid JSON payload
- `401`: Missing or invalid signature

### GET `/health`

```json
{"status": "online"}
```

## Validation Rules

### EIP-712 Orders

For DEX orders (CoWSwap, 1inch), the `receiver` field must be:
- Zero address (`0x0000000000000000000000000000000000000000`)
- The configured `ORIGIN_VAULT` address

### Transaction Calldata

For non-approval transactions with hex data:
- Decoded calldata must contain `ORIGIN_VAULT` address
- Uses Foundry's `cast 4byte-decode` for decoding

### Hyperliquid SendAsset Messages

Hyperliquid uses EIP-712 typed messages for asset transfers. The validator blocks `SendAsset` messages where the `destination` field doesn't match the signer's address.

**What it prevents:**

- Draining funds to unauthorized addresses via Hyperliquid transfers
- Social engineering attacks that trick users into signing transfers to attacker wallets

**How it works:**

1. Detects Hyperliquid messages by checking `domain.name == "HyperliquidSignTransaction"`
2. Extracts the `destination` field from the message
3. Compares it to the vault/signer address
4. Aborts if they don't match

**Example abort:**

```
❌ Hyperliquid destination 0xattacker... does not match signer 0xvault...
```

**Extending with a whitelist:**

To allow transfers to specific trusted addresses (e.g., your other vaults), modify `_validate_hyperliquid_destination` in `validators.py`:

```python
# Add allowed destinations to config or hardcode
ALLOWED_DESTINATIONS = [
    "0xYourOtherVault1".lower(),
    "0xYourOtherVault2".lower(),
]

# In the validation method, replace the strict check:
if destination != signer_address:
    # Allow if destination is in whitelist
    if destination not in ALLOWED_DESTINATIONS:
        raise TransactionAbortError(...)
```

### Swap Destination Validation

For DEX aggregator swaps (1inch-style), validates that the `dstReceiver` in the swap parameters matches the transaction initiator.

**What it prevents:**

- Swaps that send output tokens to a different address than the initiator

### Transaction States

| State | Action |
|-------|--------|
| `waiting_for_approval` | Validates and approves/aborts |
| `aborted`, `completed`, `approved`, `stuck`, `signed`, `pushed_to_blockchain`, `mined` | Skipped |

## Project Structure

```
bracket-bot/
├── bot.py                    # FastAPI application
├── fordefi/
│   ├── __init__.py
│   ├── config.py             # Configuration loading
│   ├── api.py                # Fordefi API client
│   ├── signature.py          # Webhook signature verification
│   └── validators.py         # Transaction validators
├── .env                      # Environment variables (not in repo)
└── public_key.pem            # Fordefi public key (not in repo)
```

## Troubleshooting

### `cast: command not found`

Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Signature verification fails

- Verify `FORDEFI_PUBLIC_KEY_PATH` points to correct file
- Check PEM file format is valid
- Ensure public key matches your Fordefi organization

### 400 errors on approve/abort

Expected when transaction state changed between webhook and API call. Check logs for current state.

## Production Deployment

### systemd Service

```ini
[Unit]
Description=Fordefi Validator Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/bracket-bot
Environment="PATH=/path/to/.venv/bin"
ExecStart=/path/to/.venv/bin/uvicorn bot:app --host 0.0.0.0 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

## Resources

- [Fordefi Developer Documentation](https://docs.fordefi.com/developers/program-overview)
- [Fordefi Transaction API](https://docs.fordefi.com/api/openapi/transactions)
- [Fordefi Webhooks](https://docs.fordefi.com/developers/webhooks)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Foundry Book](https://book.getfoundry.sh/)
