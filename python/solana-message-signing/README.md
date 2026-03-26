# Solana Message Signing with Fordefi

Sign personal messages using the Fordefi API and your Fordefi Solana Vault as the signer.

## Prerequisites

- Python 3.10+
- Fordefi Solana Vault
- Fordefi API User Token and API Signer (setup instructions can be found [here](https://docs.fordefi.com/developers/program-overview))

## Setup

1. Install `uv` package manager:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Set up the project and install dependencies:
   ```bash
   cd python/solana-message-signing
   uv sync
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory with the following:
   ```plaintext
   FORDEFI_API_USER_TOKEN="your_token"
   FORDEFI_SOLANA_VAULT_ID="your_vault_id"
   SOLANA_CHAIN="solana_mainnet"  # Optional: defaults to solana_mainnet
   ```

4. Place your API Signer's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

```bash
uv run sign_personal_message_solana.py
```

## How It Works

1. The script loads your Fordefi credentials from environment variables
2. Constructs a personal message for signing
3. Creates a properly formatted request to the Fordefi API
4. Signs the request payload
5. Submits the transaction to Fordefi's API endpoint
6. Waits for your Solana Vault to sign the message then displays the response
