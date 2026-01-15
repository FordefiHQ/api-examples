# Fordefi Hardhat Contract Deployer

## Overview
This script deploys an ERC20 token contract using Hardhat 3, with Fordefi as the RPC provider and a Fordefi EVM vault as the signer.

## Prerequisites
Ensure you have the following set up before running the script:

1. **Node.js and npm** installed
2. **Fordefi API Credentials:**
   - `FORDEFI_API_USER_TOKEN` must be set in a `.env` file
   - A private key file located at `./fordefi_secret/private.pem`
   - Your Fordefi EVM Vault address

## Installation

1. **Install project dependencies:**
   ```sh
   npm install
   ```

2. **Set up environment variables:**
   - Create a `.env` file in the project root:
     ```sh
     FORDEFI_API_USER_TOKEN=your_token_here
     FORDEFI_EVM_VAULT_ADDRESS=0x...
     ```
   - Place your Fordefi API Signer private key in `./fordefi_secret/private.pem`

3. **Configure your deployment:**
   - The script deploys the `Token` ERC20 contract with configurable name, symbol, decimals, and initial supply
   - Update the constructor arguments in `scripts/deploy.ts` as needed

## Build and Compile

Before deploying, compile your smart contracts:

```sh
npm run build
```

This will:
- Compile the Solidity contracts in the `contracts/` directory
- Generate artifacts in the `artifacts/` directory

## Deployment

Deploy the contract:

```sh
npm run deploy
```

Example output:

```sh
Successfully removed the listener
Connected to chain: 0x2105
Deploying Token contract...
waiting for transaction state change to 'signed' with timeout of 24h
[2026-01-15T22:27:36.041Z] transaction state is 'approved', waiting for 'signed'...
transaction reached desired state 'signed' and is now 'mined'
Token deployed to: 0xB49A4BAB25cF4A17fE873E87F2EebdBc9D6f409F
```

## The Token Contract

The `Token` contract (`contracts/MyToken.sol`) is an ERC20 token built on [Solmate](https://github.com/transmissions11/solmate):

- Inherits from Solmate's gas-optimized ERC20 implementation
- Constructor accepts name, symbol, decimals, and initial supply
- Mints the initial supply to the deployer's address

**Default deployment parameters:**
```typescript
"FordefiToken",              // name
"FRDFI",                     // symbol
18,                          // decimals
ethers.parseEther("1000000") // initial supply: 1 million tokens
```

## Contract Verification

After deploying your contract, verify it on Basescan:

```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> "FordefiToken" "FRDFI" 18 1000000000000000000000000
```

## Network Configuration

The deploy script is configured to deploy on **Base** (chain ID 8453) by default for lower gas costs. To change the target network, update the `chainId` and `rpcUrl` in `scripts/deploy.ts`:

```typescript
const fordefiConfig: FordefiProviderConfig = {
    address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
    apiUserToken: FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: PEM_PRIVATE_KEY,
    chainId: 8453,  // Base mainnet
    rpcUrl: "https://base-rpc.publicnode.com",
};
```
