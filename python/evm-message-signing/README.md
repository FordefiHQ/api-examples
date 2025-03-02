# EIP-712 Signing with Fordefi

This repository contains a Python implementation for signing EIP-712 typed data using the Fordefi API and your Fordefi EVM Vault as the signer.

## Overview

The script allows you to:
- Construct EIP-712 typed data messages
- Sign messages using a Fordefi EVM Vault.
- Optionally, decode and extract signature components (r, s, v)

## Prerequisites

- Python 3.x
- Fordefi EVM Vault
- Fordefi API User Token and API Signer (setup instructions can be found [here](https://docs.fordefi.com/developers/program-overview))

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
   FORDEFI_EVM_VAULT_ID="your_vault_id"
   ```
4. Place your API Signer's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

Run the script with:

```bash
uv run sign_eip712.py
```

## How It Works

1. The script loads your Fordefi credentials from environment variables
2. Constructs an EIP-712 typed data structure (in this example, a USDC token approval on Ethereum mainnet)
3. Creates a properly formatted request to the Fordefi API
4. Signs the request payload
5. Submits the transaction to Fordefi's `/api/v1/transactions/create-and-wait` API endpoint.
6. Waits for your EVM Vault to sign the message then displays the response, including the decoded signature components
