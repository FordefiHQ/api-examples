# Fordefi Foundry Contract Deployer

## Overview
This script deploys a smart contract using Foundry for compilation and TypeScript for deployment, with Fordefi as the RPC provider and a Fordefi vault as the signer and deployer address.

⚠️ This smart contract has not been audited and should NOT be used in a production setting, use at your own risk!

## Prerequisites
Ensure you have the following set up before running the script:

1. **Node.js and npm** installed
2. **TypeScript** installed globally (`npm install -g typescript`)
3. **Foundry** installed (see [Foundry Book](https://book.getfoundry.sh/getting-started/installation))
4. **Fordefi API Credentials:**
   - `FORDEFI_API_USER_TOKEN` must be set in a `.env` file
   - A private key file located at `./fordefi_secret/private.pem`
   - Your Fordefi EVM Vault address

## Installation

1. **Install project dependencies:**
   ```sh
   npm install --save-dev typescript ts-node @types/node
   npm install ethers @fordefi/web3-provider dotenv
   ```

2. **Set up environment variables:**
   - Create a `.env` file in the project root:
     ```sh
     FORDEFI_API_USER_TOKEN=your_access_token_here
     ```
   - Place your Fordefi API User's private key in `./fordefi_secret/private.pem`

3. **Configure your deployment:**
   - Update the vault address in `script/deploy.ts`:
     ```typescript
     address: "0x...", // Replace with your Fordefi EVM Vault address
     ```

## Deployment Process

1. **Compile your contract with Foundry:**
   ```sh
   forge build
   ```
   This will generate the contract artifacts in the `out` directory.

2. **Deploy the contract:**
   ```sh
   npx ts-node script/deploy.ts
   ```

## Network Configuration

The deployment script is configured in `script/deploy.ts`. By default, it's set up for Base (chainId: 8453), but you can modify the following parameters for your target network:

```typescript
const chainId = 137; // Change to your target network
const config = {
  // ...
  rpcUrl: "https://polygon-rpc.com/" // Change to your preferred fallback RPC
};
```

## Troubleshooting

If you encounter errors:
1. Verify all environment variables are properly set
2. Ensure your Fordefi vault has sufficient funds for deployment
3. Check that your private key file is correctly formatted and accessible
4. Verify the contract was compiled successfully (`out` directory should contain your contract artifacts)
5. Make sure the chainId and RPC URL match your target network
6. Check that the artifact path in `deploy.ts` matches your contract name