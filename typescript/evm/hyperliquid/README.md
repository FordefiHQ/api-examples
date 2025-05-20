# Hyperliquid-Fordefi Integration

A TypeScript application for interacting with Hyperliquid's DEX through Fordefi.

## Overview

This application enables secure interactions with the Hyperliquid L1 DEX from a Fordefi EVM Vault. It provides functionality for:

- Depositing USDC from your Fordefi EVM Vault to Hyperliquid
- Withdrawing funds from Hyperliquid to your Fordefi EVM Vault
- Sending USDC within the Hyperliquid ecosystem

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- Fordefi credentials: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))
- TypeScript setup:
  ```bash
  # Install TypeScript and type definitions
  npm install typescript --save-dev
  npm install @types/node --save-dev
  npm install tsx --save-dev
  
  # Initialize a TypeScript configuration file (if not already done)
  npx tsc --init
  ```

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Set up your environment variables:

```bash
cp .env.example .env
```

4. Edit the `.env` file and add your `FORDEFI_API_USER_TOKEN`

5. Place your API User's private key in `./fordefi_secret/private.pem`

## Configuration

The application is configured through the `config.ts` file:

### Fordefi Configuration

```typescript
export const fordefiConfig: FordefiProviderConfig = {
    chainId: 42161, // Arbitrum
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // Your Fordefi EVM Vault
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    skipPrediction: false 
};
```

### Hyperliquid Configuration

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    destination: "0x5b7a034488F0BDE8bAD66f49cf9587ad40B6c757", // Destination address
    amount: "6" // Amount to withdraw/send/deposit
};
```

## Usage

First, ensure that your Fordefi API Signer is running

### Deposit USDC to Hyperliquid

To deposit USDC from your Fordefi EVM Vault to Hyperliquid:

1. Make sure you have sufficient USDC in your Fordefi EVM Vault
2. Set the amount in `config.ts` (minimum 5 USDC required):

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    destination: fordefiConfig.address, // Not used for deposit but required by config
    amount: "5" // Amount must be at least 5 USDC
};
```

3. The `run.ts` file is already configured to execute the deposit function by default:

```typescript
async function main(){
    try {
        await deposit(hyperliquidConfig)
    } catch (error) {
        console.error("Oops, an error occured: ", error)
    }
}
```

4. Run the deposit command:

```bash
npm run hyperliquid
```

The deposit process uses USDC's permit functionality to approve and deposit in a single transaction. The function will:
- Fetch the current nonce for your Fordefi vault address
- Create and sign an EIP-712 permit message
- Execute the deposit through Hyperliquid's bridge contract

### Withdraw funds from Hyperliquid

To withdraw funds from Hyperliquid to your Fordefi EVM Vault:

1. Modify the `main()` function in `src/run.ts`:

```typescript
async function main(){
    try {
        await withdraw3(hyperliquidConfig)
    } catch (error) {
        console.error("Oops, an error occured: ", error)
    }
}
```

2. Run:

```bash
npm run hl
```

### Send USDC within Hyperliquid

To send USDC to another address within Hyperliquid, 

1. Modify the `destination` field in `src/config.ts`:

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    destination: "0x...", // Change to your destination address
    amount: "1"
};
```

2. Modify the `main()` function in `src/run.ts`:

```typescript
async function main(){
    try {
        // Replace deposit with usdSend
        await usdSend(hyperliquidConfig)
    } catch (error) {
        console.error("Oops, an error occured: ", error)
    }
}
```

Then run:

```bash
npm run hl
```

## Core Components

- **config.ts**: Main configuration for both Fordefi and Hyperliquid
- **hl-deposit.ts**: Handles deposits to Hyperliquid using USDC permit
- **hl-withdraw.ts**: Handles withdrawals from Hyperliquid
- **hl-send-usdc.ts**: Manages USDC transfers within Hyperliquid
- **get-provider.ts**: Creates a Fordefi Web3 Provider instance

## Troubleshooting

### Common Issues

1. **"FORDEFI_API_USER_TOKEN is not set"**
   - Ensure your `.env` file contains a valid Fordefi API user token

2. **"PEM_PRIVATE_KEY is not set"**
   - Make sure your private key file exists at `./fordefi_secret/private.pem`

3. **"Insufficient balance"**
   - Your account doesn't have enough funds for the requested withdrawal amount

4. **"Deposit amount must be at least 5 USDC"**
   - Hyperliquid requires a minimum deposit of 5 USDC

5. **USDC Approval Errors**
   - Ensure your Fordefi vault has enough USDC for the deposit
   - Check that your vault has approved the Hyperliquid bridge contract