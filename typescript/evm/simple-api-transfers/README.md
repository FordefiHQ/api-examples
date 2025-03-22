# Programmatic EVM Transfer with Fordefi

A simple script for creating programmatic EVM transfers through the Fordefi API.

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
  `

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   FORDEFI_API_USER_TOKEN=your_access_token
   VAULT_ID=your_vault_id
   VAULT_ADDRESS=your_sender_address
   ```
4. Create a `./secret` folder and place your API User's `private.pem` private key file in the folder.

## Configuration

The script contains two main configuration objects:

1. `fordefiConfig`: API connection settings
   - Loads credentials from environment variables
   - Specifies network and endpoint paths
   - For example:
   ```typescript
   const fordefiConfig = {
      accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
      vaultId: process.env.VAULT_ID || "", // Your Fordefi EVM Vault ID
      senderAddress:process.env.VAULT_ADDRESS || "", // Your Fordefi EVM Vault address
      privateKeyPath: "./secret/private.pem",
      pathEndpoint:  "/api/v1/transactions"
   };
   ```

2. `txParams`: Transaction details
   - `evmChain`: The EVM blockchain network (for example: "bsc", "arbitrum", "ethereum", etc)
   - `to`: Recipient address
   - `amount`: Transaction amount (in wei)
   - For example:
   ```typescript
   const txParams = {
      evmChain: "bsc", // Binance Smart Chain (BNB Chain)
      to: "0xF659feEE62120Ce669A5C45Eb6616319D552dD93", // third-party EVM address
      amount: "100000" // in wei (1 BNB is equal to 10^18 wei)
   };
   ```

## Usage

1. Ensure that your API Signer is running
2. Run the script with:
```
npm run tx
```