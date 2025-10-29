# Uniswap v3 Token Swap & Liquidity Provision with Fordefi

Scripts to perform token swaps and provide liquidity on Uniswap v3 with Fordefi.

## Overview

This project includes two main scripts:

1. **Token Swap**: Execute token swaps on Uniswap v3 while using your Fordefi EVM vault as the signer
2. **Liquidity Provision**: Add liquidity to Uniswap v3 pools with concentrated liquidity positions

Both scripts leverage Uniswap's SDK and handle transaction signing through Fordefi.

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- Fordefi credentials: API User access token and private keys and API Signer set up ([documentation](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker))

## Setup

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file in the root directory with your Fordefi API user token:
```bash
FORDEFI_API_USER_TOKEN=your_api_user_token_here
```

4. Create a directory `fordefi_secret` and place your API Signer's PEM private key in `fordefi_secret/private.pem`

## Configuration

Both scripts use configurations found in `config.ts`:

### 1. Fordefi Web3 Provider Configuration

For connecting to any EVM chain and orchestrating signing with your Fordefi EVM Vault:

```typescript
export const fordefiConfig: FordefiProviderConfig = {
  chainId: 1, // Mainnet
  address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  skipPrediction: false
};
```

### 2. Token Swap Configuration

Uniswap SDK configuration including the tokens to swap and slippage:

```typescript
export const CurrentConfig: ExampleConfig = {
  rpc: {
    local: '',
    mainnet: 'https://ethereum-rpc.publicnode.com',
  },
  tokens: {
    in: USDC_TOKEN,
    amountIn: 1, // in natural units (1 = 1 whole USDC)
    out: WETH_TOKEN,
    poolFee: FeeAmount.MEDIUM
  },
  wallet: {
    address: fordefiConfig.address
  },
  slippage: {
    slippageAmount: 100 // in bps (1% in this example)
  }
};
```

### 3. Liquidity Provision Configuration

Configuration for adding liquidity to Uniswap v3 pools:

```typescript
export const LiquidityProvisionConfig = {
  tokens: {
    token0: USDC_TOKEN,
    token1: WETH_TOKEN,
    token0Amount: 100,  // Amount of token0 to add (in natural units)
    token1Amount: 0.05, // Amount of token1 to add (in natural units)
    poolFee: FeeAmount.MEDIUM
  },
  priceRange: {
    rangePercent: 10 // Price range for concentrated liquidity (±10%)
  },
  slippage: {
    slippageBps: 500 // Slippage tolerance in basis points (5%)
  }
};
```

**Important Notes on Liquidity Provision:**

- The script uses a "floating amount" strategy where `token0Amount` is fixed and `token1` adjusts to match the pool's current price ratio
- This prevents "Price slippage check" reversions caused by mismatched token ratios
- `rangePercent` determines how concentrated your liquidity is (lower = more concentrated, higher fees but more risk)
- Ensure sufficient token balances and approvals for both tokens

## Usage

### Token Swap

Run the swap script with:
```bash
npm run swap
```

### Add Liquidity

Run the liquidity provision script with:
```bash
npm run lp
```