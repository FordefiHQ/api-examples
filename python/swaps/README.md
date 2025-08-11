# Fordefi Swaps API Example

A Python example demonstrating how to execute token swaps using the Fordefi API and Fordefi's native Swap feature.

## Prerequisites

- **Fordefi Setup:**
  - Fordefi organization and EVM vault
  - API User access token
  - API User private key (PEM format)
  - API Signer configured ([documentation](https://docs.fordefi.com/developers/program-overview))

## Setup

1. Install dependencies:
```bash
uv sync
```

2. Create environment variables in `.env`:
```env
FORDEFI_API_TOKEN=your_api_token_here
FOREFI_VAULT_ID=your_vault_id_here
```

3. Add your API User's private key file to `./secret/private.pem`

## Configuration

Edit `swap.py` to configure your swap:
- `sell_token_amount`: Amount to sell (in smallest unit, for example wei for ETH)
- `buy_token_address`: Token address you want to buy
- `network`: Target network (for example `evm_ethereum_mainnet`)
- `slippage`: Slippage tolerance in basis points

## Usage

Run the swap:
```bash
uv run swap.py
```

The script will:
1. Get available swap providers
2. Request a quote from 1inch
3. Submit the quote to create a transaction
4. Sign the payload with your API User's private key
5. Broadcast the transaction via Fordefi

## Files

- `swap.py` - Main script orchestrating the swap flow
- `get_provider_list.py` - Fetches available swap providers
- `get_quote.py` - Requests swap quotes from providers
- `submit_quote.py` - Creates transaction payload from quote
- `sign_payload.py` - Signs the transaction payload
- `broadcast.py` - Submits signed transaction to Fordefi
