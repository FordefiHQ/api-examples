# Fordefi Bitcoin PSBT Transaction Suite

A set of Python scripts for creating and submitting Bitcoin PSBT (Partially Signed Bitcoin Transaction) transactions to the Fordefi API.

## Overview

This project provides two main components:

1. **PSBT Construction (Single Recipient)** (`build_psbt.py`) - Constructs a PSBT for transferring BTC from one address to a single recipient
2. **PSBT Construction (Multi-Recipient)** (`build_psbt_multi.py`) - Constructs a PSBT for transferring BTC from one address to multiple recipients in a single transaction
3. **Fordefi API Submission** (`construct_api_request.py` + `run.py`) - Submits any PSBT to the Fordefi API for signing and broadcasting

**Note:** You can use the provided PSBT construction script OR provide your own pre-constructed PSBT hex data.

## Prerequisites

- Python 3.13+
- Fordefi BTC Vault with a Taproot or Segwit address
- Fordefi API User Access token, API User private key and API Signer (setup instructions can be found [here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker))

## Setup

1. Install `uv` package manager:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Set up the project and install dependencies:
   ```bash
   git clone <repository-url>
   cd <repository-name>
   uv sync
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory. You'll need different variables depending on your use case:

   **Option A: Using your own PSBT**
   ```plaintext
   PSBT_HEX_DATA="your_hex_encoded_psbt_data"
   FORDEFI_API_USER_TOKEN="your_token"
   FORDEFI_BTC_VAULT_ID="your_vault_id"
   BTC_SENDER_ADDRESS="taproot_or_segwit_address_from_btc_vault"
   ```

   **Option B: Using the single-recipient PSBT construction script**
   ```plaintext
   BTC_SENDER_ADDRESS_TESTNET_V4="tb1q..."  # Bitcoin address to spend from
   BTC_RECIPIENT_ADDRESS_TESTNET_V4="tb1q..."  # SegWit or Taproot address to send to
   BTC_TRANSFER_AMOUNT="50000"  # Amount in satoshis
   BTC_FEE="1000"  # Transaction fee in satoshis (optional, default: 200)
   BTC_NETWORK="testnet4"  # 'mainnet', 'testnet3', or 'testnet4' (optional, default: testnet4)
   ```

   **Option C: Using the multi-recipient PSBT construction script**
   ```plaintext
   BTC_SENDER_ADDRESS_TESTNET_V4="tb1q..."  # Bitcoin address to spend from
   BTC_RECIPIENTS_FILE="recipients.json"  # Path to recipients JSON file (optional, default: recipients.json)
   BTC_FEE="1000"  # Transaction fee in satoshis (optional, default: 200)
   BTC_NETWORK="testnet4"  # 'mainnet', 'testnet3', or 'testnet4' (optional, default: testnet4)
   ```

   The recipients file should be a JSON array (see `recipients_example.json`):
   ```json
   [
     {"address": "tb1q...", "amount": 50000},
     {"address": "tb1p...", "amount": 30000}
   ]
   ```

   **Important:** `BTC_SENDER_ADDRESS` must be a SegWit (bc1q/tb1q) or Taproot (bc1p/tb1p) address. Siging PSBTs with a legacy addresses (starting with '1', '3', 'm', 'n', or '2') is not supported by Fordefi and will be rejected.
4. Place your API User's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

### Option 1: Construct a single-recipient PSBT

Create a PSBT that sends BTC to one recipient:

```bash
uv run build_psbt.py
```

### Option 2: Construct a multi-recipient PSBT

Create a PSBT that sends BTC to multiple recipients in a single transaction:

```bash
uv run build_psbt_multi.py
```

Both scripts will:

- Fetch UTXOs from the blockchain for your sender address
- Create an unsigned transaction
- Generate a PSBT hex string
- Save the PSBT to `psbt_output.txt`

You can then use this PSBT hex data with the Fordefi API submission script (set it as `PSBT_HEX_DATA` in your `.env` file).

### Option 3: Submit a PSBT to Fordefi

If you have a pre-constructed PSBT (either from the script above or your own), submit it to Fordefi:

```bash
uv run run.py
```

This requires the Fordefi-specific environment variables (`FORDEFI_API_USER_TOKEN`, `FORDEFI_BTC_VAULT_ID`, etc.) and will submit the PSBT for signing and broadcasting.

## Features

### PSBT Construction Scripts

Both `build_psbt.py` (single recipient) and `build_psbt_multi.py` (multiple recipients) support:

- **Multiple address types**: Legacy P2PKH/P2SH, SegWit v0 (P2WPKH/P2WSH), and Taproot (P2TR)
- **Automatic UTXO fetching**: Uses mempool.space (testnet4) or Blockstream (mainnet/testnet3) APIs
- **Smart UTXO selection**: Automatically selects the optimal UTXOs to cover the transaction amount and fees
- **Change handling**: Automatically creates change outputs when needed
- **Multiple networks**: Supports Bitcoin mainnet, testnet3, and testnet4

The multi-recipient script (`build_psbt_multi.py`) reads recipients from a JSON file (default: `recipients.json`), where each entry specifies an `address` and `amount` in satoshis. See `recipients_example.json` for the expected format.

### Fordefi API Submission (Optional Parameters)

The `run.py` script automatically generates signer identity entries for each transaction input. Set `PSBT_NUM_INPUTS` in your `.env` file to match the number of UTXOs (inputs) used in your PSBT:

```plaintext
PSBT_NUM_INPUTS="3"  # Number of inputs in the PSBT (default: 1)
```

If not specified, it defaults to `1`, which is sufficient for single-input transactions. For multi-recipient transactions that consume multiple UTXOs, set this to the number of UTXOs reported by the construction script.
