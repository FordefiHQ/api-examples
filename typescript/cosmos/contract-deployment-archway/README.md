# Cosmos Smart Contract Deployment with Fordefi

This repository contains scripts to deploy smart contracts to the Cosmos-based Archway blockchain using Fordefi for transaction signing.

## Prerequisites

- Fordefi organization and COSMOS vault with [Archway chain activated](https://docs.fordefi.com/user-guide/manage-chains/customize-chain-visibility)
- Node.js and npm installed
- The compiled WASM binary of your smart contract
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

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   FORDEFI_API_USER_TOKEN=your_fordefi_api_token
   FORDEFI_COSMOS_VAULT_ID=your_cosmos_vault_id
   FORDEFI_COSMOS_ARCHWAY_ADDRESS=your_archway_address
   FORDEFI_COSMOS_VAULT_COMPRESSED_PUBKEY=your_compressed_pubkey
   ```

4. Create a `secret` directory and place your Fordefi API User's private key in it:
   ```bash
   mkdir -p secret
   # Place your private.pem file in the secret directory
   ```

5. Place your compiled WASM binary in the `artifacts` directory:
   ```bash
   mkdir -p artifacts
   # Copy your .wasm file to the artifacts directory
   ```

## Deployment Process

The deployment process consists of two steps:

1. Store the WASM binary on the Archway blockchain
2. Instantiate the stored contract with initial parameters

### 1. Store the WASM Binary

This step uploads your smart contract code to the blockchain and returns a code ID.

```bash
npm run store
# or
ts-node store.ts
```

The script will:
- Read your WASM binary from the artifacts directory
- Create a store code transaction
- Sign it using your Fordefi private key
- Submit it to the Fordefi API
- Output the transaction result, including the code ID

Make note of the code ID returned in the response, as you'll need it for the next step.

### 2. Instantiate the Contract

This step creates a new instance of your uploaded contract code with the provided initialization parameters.

Before running the script,

1- Ensure that your Fordefi API Signer is running.
2- Update the following variables in `instantiate.ts`:

```typescript
// Update these values
const codeId = 853; // Replace with the actual code ID from the previous step
const contractLabel = "Your Contract Label";
const instantiateMsg = {
  // Your contract initialization parameters
  count: 42
};
```

Then run:

```bash
npm run instantiate
# or
ts-node instantiate.ts
```

The script will:
- Create an instantiate transaction with your initialization parameters
- Submit it to the Fordefi API
- Output the transaction result

## Configuration

Both scripts use the same configuration object in `src/config.ts`:

```typescript
const fordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  vaultId: process.env.FORDEFI_COSMOS_VAULT_ID || "",
  senderAddress: process.env.FORDEFI_COSMOS_ARCHWAY_ADDRESS || "",
  compressedPubKey: process.env.FORDEFI_COSMOS_VAULT_COMPRESSED_PUBKEY || "",
  privateKeyPath: "./secret/private.pem",
  pathEndpoint: "/api/v1/transactions"
};
```

## Troubleshooting

### 1. API Authentication Issues

If you encounter authentication errors, make sure:
- Your FORDEFI_API_USER_TOKEN is valid
- Your private.pem file contains the correct private key

### 2. Transaction Failures

If your transactions fail:
- Verify that your Archway address has sufficient ARCH tokens for gas fees
- Ensure the WASM binary is compatible with the Archway blockchain

### 3. Finding Your Compressed Public Key

To get your compressed public key:
1. Make a GET request to `https://api.fordefi.com/api/v1/vaults/{your_cosmos_vault_id}`
2. Look for the `public_key_compressed` value in the response

## Additional Resources

- [Fordefi API Documentation](https://docs.fordefi.com/)
- [Archway Developer Documentation](https://docs.archway.io/)
- [Cosmos SDK Documentation](https://docs.cosmos.network/)