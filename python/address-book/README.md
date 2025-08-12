# Fordefi Address Book API Example

Programmaticaly sdd contacts to your Fordefi Address Book using the API.

## Prerequisites

- API User access token
- API User private key (PEM format)
- API Signer configured ([documentation](https://docs.fordefi.com/developers/program-overview))

## Setup

1. Install dependencies:
```bash
uv sync
```

2. Create `.env` file:
```env
FORDEFI_API_TOKEN=your_api_token_here
EVM_VAULT_ID=your_vault_id_here
```

3. Place your private key at `secret/private.pem`

## Usage

```bash
python add-contact.py
```

Edit the contact details in `add-contact.py`:
```python
name = "Pendle router"
chain_type = "evm"
chains = ["evm_ethereum_mainnet"]
contact_address = "0x888888888889758F76e7103c6CbF23ABbF58F946"
```

## Files

- `add-contact.py` - Main script to add contacts
- `sign_payload.py` - ECDSA signing with private key
- `broadcast.py` - API request handling
