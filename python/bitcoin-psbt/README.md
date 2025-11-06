# Fordefi Bitcoin PSBT Transaction Suite

A set of Python scripts for creating and submitting Bitcoin PSBT (Partially Signed Bitcoin Transaction) transactions to the Fordefi API.

## Overview

This project provides two main components:

1. **PSBT Construction** (`build_psbt.py`) - A utility script that constructs a PSBT for transferring BTC from one address to another by fetching UTXOs from the blockchain
2. **Fordefi API Submission** (`construct_api_request.py` + `run.py`) - Submits any PSBT to the Fordefi API for signing and broadcasting

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

   **Option B: Using the PSBT construction script**
   ```plaintext
   BTC_SENDER_ADDRESS="tb1q..."  # Bitcoin address to spend from
   BTC_RECIPIENT_ADDRESS="tb1q..."  # SegWit (bc1q/tb1q) or Taproot (bc1p/tb1p) address to send to
   BTC_SEND_AMOUNT="50000"  # Amount in satoshis
   BTC_FEE="1000"  # Transaction fee in satoshis (optional, default: 200)
   BTC_NETWORK="testnet"  # 'testnet' or 'mainnet' (optional, default: testnet)
   ```

   **Important:** `BTC_RECIPIENT_ADDRESS` must be a SegWit (bc1q/tb1q) or Taproot (bc1p/tb1p) address. Legacy addresses (starting with '1', '3', 'm', 'n', or '2') are not supported by Fordefi and will be rejected.
4. Place your API User's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

### Option 1: Construct a PSBT

If you want to create a PSBT from scratch, run the construction script:

```bash
uv run build_psbt.py
```

This will:
- Fetch UTXOs from the blockchain for your sender address
- Create an unsigned transaction
- Generate a PSBT hex string
- Save the PSBT to `psbt_output.txt`

You can then use this PSBT hex data with the Fordefi API submission script (set it as `PSBT_HEX_DATA` in your `.env` file).

### Option 2: Submit a PSBT to Fordefi

If you have a pre-constructed PSBT (either from the script above or your own), submit it to Fordefi:

```bash
uv run run.py
```

This requires the Fordefi-specific environment variables (`FORDEFI_API_USER_TOKEN`, `FORDEFI_BTC_VAULT_ID`, etc.) and will submit the PSBT for signing and broadcasting.

## Features

### PSBT Construction Script

The `build_psbt.py` script supports:
- **Multiple address types**: Legacy P2PKH/P2SH, SegWit v0 (P2WPKH/P2WSH), and Taproot (P2TR)
- **Automatic UTXO fetching**: Uses Blockstream API to fetch UTXOs for any Bitcoin address
- **Smart UTXO selection**: Automatically selects the optimal UTXOs to cover the transaction amount and fees
- **Change handling**: Automatically creates change outputs when needed
- **Both networks**: Supports Bitcoin mainnet and testnet

### Fordefi API Submission (Optional Parameters)

You can optionally specify input parameters in `construct_api_request.py` when you need to explicitly define which addresses sign specific inputs. If not specified, Fordefi will auto-detect signers based on your PSBT data.

```python
# Example input configuration
inputs = [
    {
        "index": 0,  # Input index
        "signer_identity": {
            "type": "address",
            "address": "bc1p..."  # Taproot or Segwit address that will sign this input
        }
    }
]
```

These inputs will be included in the API request to specify which addresses should sign particular transaction inputs.
