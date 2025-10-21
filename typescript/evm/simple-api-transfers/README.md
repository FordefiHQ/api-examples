# Programmatic EVM Transfer with Fordefi

A simple script for creating programmatic EVM transfers through the Fordefi API using raw API calls.

## Overview

This implementation demonstrates **low-level direct API integration** with Fordefi. It makes raw HTTP requests to the Fordefi API and handles authentication manually.

**Alternative:** For a higher-level abstraction, consider using the [Fordefi Web3 Provider](https://github.com/FordefiHQ/web3-provider), which wraps API calls and abstracts authentication for easier integration.

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

## Setup

1. Clone this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:

   ```env
   FORDEFI_API_USER_TOKEN=your_access_token
   VAULT_ID=your_vault_id
   VAULT_ADDRESS=your_sender_address
   ```

4. Create a `./secret` folder and place your API User's `private.pem` private key file in the folder.

## Configuration

Edit the [config.ts](config.ts) file to customize your transaction parameters. The script uses TypeScript interfaces for type safety:

### 1. `fordefiConfig`: API connection settings

```typescript
export interface FordefiConfig {
  accessToken: string;        // Your Fordefi API User access token
  vaultId: string;            // Your Fordefi EVM Vault ID
  senderAddress: string;      // Your Fordefi EVM Vault address
  privateKeyPath: string;     // Path to your API User private key
  pathEndpoint: string;       // API endpoint path
}
```

These values are loaded from environment variables (see Setup step 3).

### 2. `txParams`: Transaction details

```typescript
export interface TxParams {
  evmChain: string;                      // Target blockchain (e.g., "ethereum", "polygon", "arbitrum")
  use_secure_node: boolean;              // Use Flashbots RPC (Ethereum mainnet only)
  to: string;                            // Recipient address
  amount: string;                        // Amount in wei (10^18 wei = 1 ETH)
  gas_limit: string;                     // Maximum gas units for the transaction
  max_fee_per_gas?: string;              // Maximum fee per gas unit (EIP-1559)
  max_priority_fee_per_gas?: string;     // Priority fee for miners (EIP-1559)
}
```

**Important notes:**

- All amounts and gas values are in **wei**
- We assume `dynamic` gas
- `max_fee_per_gas` must be ≥ `max_priority_fee_per_gas` (EIP-1559 requirement)
- Gas parameters are optional but recommended for better transaction control
- `use_secure_node` only works on Ethereum mainnet (uses Flashbots RPC)

## Usage

1. Ensure that your API Signer is running
2. Run the script with:

   ```bash
   npm run tx
   ```
