# Message Signing with Fordefi

Sign messages across EVM, Solana, Tron, and Starknet blockchains using Fordefi Vaults.

## Overview

| Chain    | Scripts                                              | Message Types                        |
|----------|------------------------------------------------------|--------------------------------------|
| EVM      | `evm/sign_eip712.py`, `evm/sign_personal_message.py`, `evm/sign_aster_order.py` | EIP-712 typed data, EIP-191 personal, Aster (chainId 1666) order auth |
| Solana   | `solana/sign_personal_message.py`                    | Personal message                     |
| Tron     | `tron/sign_personal_message.py`                      | Personal message (v2)                |
| Starknet | `starknet/sign_typed_message.py`                     | SNIP-12 typed data                   |

## Prerequisites

- Python 3.10+
- Fordefi Vault(s) for target chain(s)
- Fordefi API User Token and API Signer ([setup guide](https://docs.fordefi.com/developers/program-overview))

## Setup

1. Install `uv` package manager:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Install dependencies:
   ```bash
   cd python/message-signing
   uv sync
   ```

3. Configure environment variables:
   Create a `.env` file with your credentials:
   ```plaintext
   FORDEFI_API_USER_TOKEN="your_token"

   # EVM (required for EVM scripts)
   FORDEFI_EVM_VAULT_ID="your_evm_vault_id"
   EVM_CHAIN="evm_1"
   # ASTER_SIGNER_ADDRESS="0x..."  # only for evm/sign_aster_order.py — the vault's 0x address, registered with Aster

   # Solana (required for Solana scripts)
   FORDEFI_SOLANA_VAULT_ID="your_solana_vault_id"
   # SOLANA_CHAIN="solana_mainnet"  # optional, defaults to mainnet

   # Tron (required for Tron scripts)
   FORDEFI_TRON_VAULT_ID="your_tron_vault_id"
   # TRON_CHAIN="tron_mainnet"  # optional, defaults to mainnet

   # Starknet (required for Starknet scripts)
   FORDEFI_STARKNET_VAULT_ID="your_starknet_vault_id"
   # STARKNET_CHAIN="starknet_mainnet"  # optional, defaults to mainnet ("starknet_sepolia" for testnet)
   ```

4. Place your API Signer's `.pem` private key in the `secret/` directory.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```

## Usage

All scripts are run from the `message-signing/` directory:

### EVM

```bash
uv run python evm/sign_eip712.py
uv run python evm/sign_personal_message.py
uv run python evm/sign_aster_order.py   # Aster (chainId 1666) order auth signature; requires ASTER_SIGNER_ADDRESS
```

### Solana

```bash
uv run python solana/sign_personal_message.py
```

### Tron

```bash
uv run python tron/sign_personal_message.py
```

### Starknet

```bash
uv run python starknet/sign_typed_message.py
```

## Project Structure

```
message-signing/
├── shared/                 # Shared Fordefi connectivity utils
│   ├── signer.py           # ECDSA payload signing
│   └── api_client.py       # Fordefi API request helper
├── evm/                    # EVM message signing
│   ├── sign_eip712.py      # EIP-712 typed data signing
│   ├── sign_personal_message.py  # EIP-191 personal message signing
│   ├── sign_aster_order.py       # Aster (chainId 1666) futures order auth signing
│   └── construct_request.py     # EVM request builders
├── solana/                 # Solana message signing
│   ├── sign_personal_message.py
│   └── construct_request.py
├── tron/                   # Tron message signing
│   ├── sign_personal_message.py
│   └── construct_request.py
├── starknet/               # Starknet message signing
│   ├── sign_typed_message.py    # SNIP-12 typed data signing
│   └── construct_request.py
└── secret/                 # API Signer private key (gitignored)
```

## How It Works

1. Load Fordefi credentials from `.env`
2. Construct a chain-specific message signing request
3. Sign the request payload with your API Signer's ECDSA private key
4. Submit to `POST /api/v1/transactions/create-and-wait`
5. Wait for your Vault to sign the message and return the response
6. (EVM only) Decode signature components (r, s, v) and recover signer address
