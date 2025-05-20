# Uniswap v3 Token Swap with Fordefi

A script to perform token swaps on Uniswap v3 with Fordefi.

## Overview

This script enables you to execute token swaps on Uniswap v3 while using your Fordefi EVM vault as the signer. It leverages Uniswap's SDK to get quotes, find routes and create orders, with transaction signing handled by Fordefi.

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- Fordefi credentials: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))

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

The script uses the following main configurations found in `config.ts`:

1. The Fordefi Web3 Provider configuration for connecting to any EVM chain and orchestrate signing your swap with your Fordefi EVM Vault:

```typescript
export const fordefiConfig: FordefiProviderConfig = {
  chainId: 1, // Mainet
  address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN  
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  skipPrediction: false 
};
```
2. The Uniswap SDK configuration including the tokens to swap, the Fordefi Vault that will perform the swap and the slippage for your swap.
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
    address:fordefiConfig.address
  },
  slippage:{
    slippageAmount: 100 // in bps (1% in this example)
  }
};
```

## Usage

Run the script with:
```bash
npm run swap
```