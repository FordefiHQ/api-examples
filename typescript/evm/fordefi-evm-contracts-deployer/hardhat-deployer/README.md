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
   - The script is configured to deploy the example "Greeter" contract

## Build and Compile

Before deploying, you need to compile your smart contracts:

1. **Compile the contracts:**
   ```sh
   npx hardhat compile
   ```
   This will:
   - Compile the Solidity contracts in the `contracts/` directory
   - Generate artifacts in the `artifacts/` directory
   - Generate TypeScript types in the `typechain-types/` directory

2. **Verify compilation:**
   - Check that `artifacts/` directory contains the compiled contract artifacts
   - Check that `typechain-types/` directory contains TypeScript type definitions

## Build Scripts

You can also add these convenient scripts to your `package.json`:

```json
{
  "scripts": {
    "compile": "hardhat compile",
    "clean": "hardhat clean",
    "deploy:polygon": "hardhat run --network polygon scripts/deploy.ts",
    "deploy:hyperevm": "hardhat run --network hyperevm scripts/deploy.ts"
  }
}
```

Then you can run:
```sh
npm run compile
npm run deploy
```

## Network Configuration

Ensure your `hardhat.config.ts` includes the network configuration for your target chain. Example:
```typescript
networks: {
  hyperevm: {
    url: "FALLBACK_RPC_URL", // This is a fallback RPC provider
    chainId: 999 // Change depending on your target network for deployment
  }
}
```

## The Greeter Contract

The example contract (`contracts/Greeter.sol`) is a simple demonstration contract that:

- Contains a single function `sayHello(string memory h)` that accepts a string parameter
- Validates that the input string exactly matches "hello Fordefi!" (case-sensitive)
- Returns "hello!" if the validation passes
- Reverts with the message "must say hello Fordefi!" if the input doesn't match

This contract demonstrates:
- Basic Solidity syntax and structure
- Input validation using `require()`
- String comparison using `keccak256` hashing
- Pure functions (no state modification)

**Example Usage:**
```javascript
// This will succeed and return "hello!"
await greeterContract.sayHello("hello Fordefi!");

// This will revert with "must say hello Fordefi!"
await greeterContract.sayHello("hello world!");
```

## Contract Verification Examples

After deploying your contract, you can verify it on block explorers using Hardhat's verification plugin. First, install the verification plugin:

```sh
npm install --save-dev @nomiclabs/hardhat-etherscan
```

Add it to your `hardhat.config.ts`:
```typescript
import "@nomiclabs/hardhat-etherscan";

// Add to your config
etherscan: {
  apiKey: "YOUR_API_KEY_HERE"
}
```

### On Etherscan (Ethereum Mainnet)
```bash
npx hardhat verify --network mainnet CONTRACT_ADDRESS
```

### On HyperEVM (Polygon)
```bash
npx hardhat verify --network polygon CONTRACT_ADDRESS
```