# Fordefi Address Book API Example

Programmaticaly add contacts to your Fordefi Address Book using the API.

## Prerequisites

- API User access token
- API User private key (PEM format)
- API Signer configured ([documentation](https://docs.fordefi.com/developers/program-overview))
- UV installed ([learn more](https://docs.astral.sh/uv/guides/install-python/))

## Setup

1. Install dependencies:
```bash
uv init
uv sync
```

2. Create `.env` file:
```env
FORDEFI_API_TOKEN=your_api_token_here
EVM_VAULT_ID=your_vault_id_here
```

3. Place your private key at `secret/private.pem`

## Usage

### Add a Single Contact

```bash
uv run add-contact.py
```

Edit the contact details in `add-contact.py`:
```python
name = "Pendle router"
chain_type = "evm"
chains = ["evm_ethereum_mainnet"]
contact_address = "0x888888888889758F76e7103c6CbF23ABbF58F946"
```

### Add Multiple Contacts (Batch)

```bash
uv run add-batch.py
```

Edit the contacts list in `add-batch.py`:
```python
"contacts": [
    {
    "name": "Batcher Ethereum",
    "type": chain_type,
    "address": "0x7D8D7e776aC41c5F819965b2E288b2D03fe517aE",
    "chains":["evm_ethereum_mainnet"]
    },
    {
    "name": "Batcher Base",
    "type": chain_type,
    "address": "0x8D1A4e041A3080d9a4170e7606B5255c23298886",
    "chains":["evm_base_mainnet"]
    }
]
```
