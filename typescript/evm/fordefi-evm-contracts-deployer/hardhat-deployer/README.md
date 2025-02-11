# Fordefi Hardhat Contract Deployer

## Overview
This script deploys an example smart contract using Hardhat, with Fordefi as the RPC provider and a Fordefi vault as the signer.

## Prerequisites
Ensure you have the following set up before running the script:

1. **Node.js and npm** installed
2. **TypeScript** installed globally (`npm install -g typescript`)
3. **Fordefi API Credentials:**
   - `FORDEFI_API_USER_TOKEN` must be set in a `.env` file
   - A private key file located at `./fordefi_secret/private.pem`
   - Your Fordefi EVM Vault address
4. **Hardhat configuration file** should include a chain ID with a fallback RPC option and chain ID

## Installation

1. **Install project dependencies:**
   ```sh
   npm install --save-dev hardhat @nomicfoundation/hardhat-ethers ethers viem
   npm install --save-dev typescript ts-node @types/node
   npm install @fordefi/web3-provider dotenv
   ```

2. **Set up environment variables:**
   - Create a `.env` file in the project root:
     ```sh
     FORDEFI_API_USER_TOKEN=your_token_here
     ```
   - Place your Fordefi API Signer private key in `./fordefi_secret/private.pem`

3. **Configure your deployment:**
   - Update the vault address in `scripts/deploy.ts`:
     ```typescript
     address: "0x...", // Replace with your Fordefi EVM Vault address
     ```
   - The script is configured to deploy an example "Lock" contract with:
     - Unlock date: January 1st, 2030
     - Value: 0.001 ETH (1 Gwei)

## Deployment

Deploy the contract to your chosen network:
```sh
npx hardhat run --network polygon scripts/deploy.ts
```

## Network Configuration

Ensure your `hardhat.config.ts` includes the network configuration for your target chain. Example:
```typescript
networks: {
  polygon: {
    url: "FALLBACK_RPC_URL", // This is a fallback RPC provider
    chainId: 137 // Change depending on your target network for deployment
  }
}
```

## Troubleshooting

If you encounter errors:
1. Verify all environment variables are properly set
2. Ensure your Fordefi vault has sufficient funds for deployment
3. Check that your private key file is correctly formatted and accessible
4. Verify network configuration matches your target chain