# Uniswap v3 Token Swap & Liquidity Provision with Fordefi

Scripts to perform token swaps and provide liquidity on Uniswap v3 with Fordefi.

## Overview

This project includes three main scripts:

1. **Token Swap**: Execute token swaps on Uniswap v3 while using your Fordefi EVM vault as the signer
2. **Liquidity Provision (Mint)**: Create a new liquidity position in Uniswap v3 pools with concentrated liquidity
3. **Increase Liquidity**: Add more liquidity to an existing Uniswap v3 position

All scripts leverage Uniswap's SDK and handle transaction signing through Fordefi.

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

### 3. Position Token ID Configuration

When you create a new liquidity position, you'll receive a position token ID. Set this in your config to manage that position:

```typescript
export const POSITION_TOKEN_ID = "1118150"
```

### 4. Liquidity Provision Configuration

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

#### The "Floating Amount" Strategy

Both the mint and increase liquidity scripts use a **"floating amount" strategy** to prevent "price slippage check" errors:

- **Token0 (USDC)**: Set as your **target amount** - this is the exact amount you want to deposit
  - Example: `token0Amount: 5` means you want to add exactly 5 USDC
  
- **Token1 (WETH)**: Set as **flexible/floating** - Uniswap calculates the exact amount needed
  - The value you set (e.g., `token1Amount: 0.001`) is used as a base estimate
  - Internally, the script multiplies this by 10x as a maximum cap
  - `amount1Min` is set to 0, allowing Uniswap to calculate the precise amount based on pool price
  - Only the exact amount needed (according to current pool price) will be used

**Why This Works:**

Uniswap V3 requires liquidity to be added at the exact ratio matching the current pool price. If you try to force both token amounts, you'll get "price slippage check" errors because:
- The pool price changes constantly
- Even small differences cause the transaction to revert

The floating amount strategy solves this by:
1. ✅ You control exactly how much token0 (USDC) to add
2. ✅ Uniswap automatically calculates the correct token1 (WETH) amount
3. ✅ The ratio always matches perfectly - no more reverts!

**Configuration Example:**
```typescript
token0Amount: 5,      // Add exactly 5 USDC
token1Amount: 0.001,  // Estimate ~0.001 WETH (actual will be calculated by Uniswap)
```

**Other Configuration Details:**

- `rangePercent` determines how concentrated your liquidity is (lower = more concentrated, higher fees but more risk)
- Ensure sufficient token balances for both tokens - have extra token1 since the exact amount needed will be calculated
- The scripts handle token approvals automatically

## Usage

### Token Swap

Run the swap script with:
```bash
npm run swap
```

### Create New Liquidity Position

Run the liquidity provision script to mint a new position:
```bash
npm run lp
```

This will create a new NFT position and output the position token ID. Copy this ID and add it to your `config.ts`:

```typescript
export const POSITION_TOKEN_ID = "1118150" // Replace with your token ID
```

### Increase Liquidity on Existing Position

After setting your `POSITION_TOKEN_ID` in the config, run:
```bash
npm run increase
```

The script will:
1. Use the position token ID from your config
2. Fetch your existing position details
3. Verify it matches your configured tokens
4. Add the amounts specified in `LiquidityProvisionConfig`
5. Handle token approvals automatically
6. Display the updated position information