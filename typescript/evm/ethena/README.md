# Ethena USDe Minting/Redemption Helper for Fordefi

Helper code for minting and redeeming USDe stablecoin using the Ethena protocol and your Fordefi EVM vault.

⚠️ Your Fordefi EVM vault address MUST be whitelisted by Ethena for mint/redeem operations. If not, request whitelisting through [Ethena's Discord](https://docs.ethena.fi/)

## Overview

This tool automates the process of minting or redeeming USDe tokens through Ethena's RFQ system while using a Fordefi EVM vault for transaction signing and execution. It handles the entire workflow including:

- Fetching RFQ (Request for Quote) data from Ethena
- Creating and formatting mint/redeem orders
- Checking and handling token allowances
- Signing orders with your Fordefi vault
- Submitting transactions to the Ethereum network through Fordefi

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- USDT or USDC tokens in your Fordefi vault (for minting)
- USDe tokens in your Fordefi vault (for redeeming)
- Fordefi credentials: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))
- Whitelisted address: Your Fordefi vault address must be whitelisted by Ethena. If not, request whitelisting through Ethena's Discord
- TypeScript setup:
  ```bash
  # Install TypeScript and type definitions
  npm install typescript --save-dev
  npm install @types/node --save-dev
  npm install tsx --save-dev
  
  # Initialize a TypeScript configuration file (if not already done)
  npx tsc

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
4. Edit the `.env` file with your Fordefi API credentials:
   ```
   FORDEFI_API_USER_TOKEN=your_api_token_here
   ```
5. Create a `fordefi_secret` directory and place your Fordefi private key as `private.pem` inside it:
   ```bash
   mkdir fordefi_secret
   # Copy your private key to fordefi_secret/private.pem
   ```

## Configuration

### Fordefi Configuration

The `fordefiConfig` object in `config.ts` contains your Fordefi wallet configuration:

```typescript
export const fordefiConfig: FordefiProviderConfig = {
  address: "0xabcd1234...", // Your Fordefi EVM Vault address
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN || "",  // From .env file
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'), // Your private key
  chainId: EvmChainId.NUMBER_1, // Mainnet
  rpcUrl: "https://eth.llamarpc.com" // backup RPC endpoint
};
```

You should update:
- The `address` field with your Fordefi vault address
- Ensure your `apiUserToken` is set in the .env file
- Make sure your API User's private key is correctly placed in `./fordefi_secret/private.pem`

### Mint/Redeem Configuration

Edit the `mintOrder` object in `config.ts` to customize your mint/redeem operation:

```typescript
export const mintOrder: MintOrder = {
  amount: 10000,                        // Amount in token units (1 = 1 USDC/USDT)
  collateralAsset: "USDT",              // "USDT" or "USDC"
  benefactor: checksumAddress(
    fordefiConfig.address
  ) as Address,                         // Your Fordefi address
  side: "MINT",                         // "MINT" or "REDEEM"
  allowInfiniteApprovals: false,        // Set to true for infinite approvals
  collateralAddresses: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // mainnet
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7"  // mainnet
  }
};
```

### Key Configuration Options

- `amount`: The amount of tokens you want to mint or redeem
- `collateralAsset`: Choose between "USDT" or "USDC" as collateral
- `side`: Set to "MINT" to create new USDe or "REDEEM" to convert USDe back to collateral
- `allowInfiniteApprovals`: Whether to approve unlimited spending (not recommended for security reasons)

## Usage

Run the script with:

```bash
npm run ethena
```

## Troubleshooting

Common issues:
## Troubleshooting

Common issues:
- **Insufficient balance**: Ensure you have enough tokens in your Fordefi vault
- **RFQ errors**: Check that the Ethena API is available and your requested amount is within limits
- **BenefactorNotWhitelisted**: Ethena will reject mint/redeem operations if your address is not whitelisted. Open a ticket on the Ethena Discord to request whitelisting for your address.
