# Fordefi PSBT Transaction Creator

A Python script for creating and submitting Bitcoin PSBT (Partially Signed Bitcoin Transaction) transactions to the Fordefi API.

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
   Create a `.env` file in the root directory with the following:
   ```plaintext
   FORDEFI_API_USER_TOKEN="your_token"
   FORDEFI_BTC_VAULT_ID="your_vault_id"
   FORDEFI_BTC_VAULT_TAPROOT_ADDRESS="taproot_address_from_btc_vault"
   FORDEFI_BTC_VAULT_SEGWIT_ADDRESS="segwit_address_from_btc_vault
   ```
4. Place your API User's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

1. Add your hex PSBT data in `psbt.py`:
   ```python
   # In psbt.py, replace the placeholder with your PSBT data
   psbt_hex_data = "0x70736274ff...." # Replace with your actual PSBT hex data
   ```

2. Run the script:
   ```bash
   uv run psbt.py
   ```

## Expected Output

Upon successful execution, the script will:

- Create a transaction in your Fordefi vault
- Return a transaction ID that can be tracked in the Fordefi dashboard
- The transaction will be pending approval/signing based on your vault's policy

## Optional Parameters

### Transaction Inputs

You can optionally specify input parameters in `construct_request.py` when you need to explicitly define which addresses sign specific inputs. If not specified, Fordefi will auto-detect signers based on your PSBT data.

```python
# Example input configuration
inputs = [
    {
        "index": 0,  # Input index
        "signer_identity": {
            "type": "address",
            "address": "bc1p..." # Taproot address that will sign this input
        }
    }
]
```

These inputs will be included in the API request to specify which addresses should sign particular transaction inputs.
