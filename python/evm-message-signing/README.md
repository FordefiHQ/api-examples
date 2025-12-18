# EVM Message Signing with Fordefi

This repository contains Python implementations for signing EVM messages using the Fordefi API and your Fordefi EVM Vault as the signer.

## Overview

This project includes two scripts:

### `sign_eip712.py` - EIP-712 Typed Data Signing

- Construct EIP-712 typed data messages
- Sign structured data using a Fordefi EVM Vault
- Decode and extract signature components (r, s, v)

### `sign_personal_message.py` - Personal Message Signing (EIP-191)

- Sign arbitrary text messages using a Fordefi EVM Vault
- Supports any EVM-compatible chain
- Decode and extract signature components (r, s, v)

## Prerequisites

- Python 3.8+
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
   EVM_CHAIN="evm_1"  # Optional: defaults to Ethereum mainnet for personal message signing
   ```

4. Place your API Signer's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

### Sign EIP-712 Typed Data

```bash
uv run sign_eip712.py
```

### Sign Personal Message

Edit the `MESSAGE` variable in `sign_personal_message.py` with your message, then run:

```bash
uv run sign_personal_message.py
```

## How It Works

1. The script loads your Fordefi credentials from environment variables
2. Constructs the message (EIP-712 typed data or personal message)
3. Creates a properly formatted request to the Fordefi API
4. Signs the request payload
5. Submits the transaction to Fordefi's API endpoint
6. Waits for your EVM Vault to sign the message then displays the response, including the decoded signature components
