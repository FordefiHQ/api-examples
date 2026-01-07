# Fordefi Swaps API Example

Python helper code for demonstrating how to execute token swaps using the Fordefi's native Swap API.

## Prerequisites

- Fordefi organization and EVM or Solana vault
- API User access token
- API User private key (PEM format)
- API Signer configured ([documentation](https://docs.fordefi.com/developers/program-overview))
- UV installed ([learn more](https://docs.astral.sh/uv/guides/install-python/))

> **⚠️ Note:** If you want to use UniswapX as a quote provider, please contact Fordefi support to have this feature activated for your organization.

## Setup

1. Install dependencies:
```bash
uv init
uv sync
```

2. Create environment variables in `.env`:
```env
FORDEFI_API_TOKEN=your_api_token_here
FORDEFI_VAULT_ID=your_vault_id_here
FORDEFI_SOLANA_VAULT_ID=your_solana_vault_id_here
```

3. Add your API User's private key file to `./secret/private.pem`

## Configuration

### EVM Swaps

Edit `swap.py` to configure your swap:
- `sell_token_amount`: Amount to sell (in smallest unit, e.g. wei for ETH)
- `buy_token_address`: Token address you want to buy
- `network`: Target network (e.g. `evm_ethereum_mainnet`)
- `slippage`: Slippage tolerance in basis points

### Solana Swaps

Edit `swap_solana.py` to configure your swap:
- `sell_token_amount`: Amount to sell (in smallest units/lamports)
- `sell_token_address`: SPL token address to sell
- `buy_token_address`: SPL token address to buy
- `slippage`: Slippage tolerance in basis points

> **⚠️ Important:** Solana swaps always use SPL tokens. To swap SOL, use the wrapped SOL (wSOL) address: `So11111111111111111111111111111111111111112`

## Usage

### EVM Swap
```bash
uv run swap.py
```

### Solana Swap
```bash
uv run swap_solana.py
```

The script will:
1. Get available swap providers
2. Request quotes from all available providers
3. Compare quotes and automatically select the best one
4. Submit the best quote to create a transaction
5. Sign the payload with your API User's private key
6. Broadcast the transaction via Fordefi

## Files

- `swap.py` - Main script orchestrating the EVM swap flow
- `swap_solana.py` - Main script orchestrating the Solana swap flow
- `get_provider_list.py` - Fetches available swap providers
- `get_quote.py` - Requests swap quotes from providers
- `submit_quote.py` - Creates transaction payload from quote
- `sign_payload.py` - Signs the transaction payload
- `broadcast.py` - Submits signed transaction to Fordefi
