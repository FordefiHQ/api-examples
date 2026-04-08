# Fordefi Foundry Contract Deployer

## Overview
This script deploys a smart contract using Foundry for compilation and TypeScript for deployment, with Fordefi as the RPC provider and a Fordefi vault as the signer and deployer address.

⚠️ This smart contract has not been formally audited and should NOT be used in a production setting, use at your own risks!

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
   npm install
   ```

2. **Install Solidity dependencies:**
   ```sh
   forge install OpenZeppelin/openzeppelin-contracts --no-git
   ```

3. **Set up environment variables:**
   - Create a `.env` file in the project root:
     ```sh
     FORDEFI_API_USER_TOKEN=your_access_token_here
     ```
   - Place your Fordefi API User's private key in `./fordefi_secret/private.pem`

4. **Configure your deployment:**
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
   npm run deploy
   ```

## Network Configuration

The deployment script is configured in `script/deploy.ts`. By default, it's set up for Base (chainId: 8453), but you can modify the following parameters for your target network:

```typescript
const chainId = 1; // Change to your target network
const config = {
  // ...
  rpcUrl: "https://ethereum-rpc.publicnode.com" // Change to your preferred fallback RPC
};
```

## Contract verification examples

### On Ethereum mainnet (Etherscan V2 API)
```bash
forge verify-contract \
  --rpc-url https://ethereum.publicnode.com \
  --verifier etherscan \
  --verifier-url 'https://api.etherscan.io/v2/api?chainid=1' \
  --etherscan-api-key ETHERSCAN_API_KEY \
  CONTRACT_ADDRESS \
  src/Batcher.sol:BatchTransfer
```

### On Ethereum Sepolia (Etherscan V2 API)
```bash
forge verify-contract \
  --rpc-url https://sepolia.infura.io/v3/YOUR_INFURA_KEY \
  --verifier etherscan \
  --verifier-url 'https://api.etherscan.io/v2/api?chainid=11155111' \
  --etherscan-api-key YOUR_ETHERSCAN_API_KEY \
  CONTRACT_ADDRESS \
  src/YourContract.sol:YourContractName
```

### On Base (Etherscan V2 API)
```bash
forge verify-contract \
  --rpc-url https://mainnet-preconf.base.org \
  --verifier etherscan \
  --verifier-url 'https://api.etherscan.io/v2/api?chainid=8453' \
  --etherscan-api-key YOUR_ETHERSCAN_API_KEY \
  CONTRACT_ADDRESS \
  src/Batcher.sol:BatchTransfer
```
### On Blockscout (Base):
```bash
forge verify-contract \
  --rpc-url https://mainnet-preconf.base.org \
  --verifier blockscout \
  --verifier-url 'https://base.blockscout.com/api' \
  CONTRACT_ADDRESS \
  src/Batcher.sol:BatchTransfer
```

## Interacting with a Deployed Contract

⚠️ This smart contract has not been formally audited. Have it audited before using in production — use at your own risk!

Once deployed, you can interact with the BatchTransfer contract using the included client script.

**1. Add `CONTRACT_ADDRESS` to your `.env`:**
```sh
CONTRACT_ADDRESS=0x...  # your deployed BatchTransfer address
```

**2. Configure the batch operation in `script/client-config.ts`:**
```typescript
export const batchConfig: BatchConfig = {
  mode: "batchSendETHSameAmount",  // or "batchSendETHDifferentAmounts", "batchSendTokenSameAmount", "batchSendTokenDifferentAmounts"
  recipients: [ // change to your recipients
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
  ],
  amountPerRecipient: ethers.parseEther("0.001").toString(),
  // amounts: [...],       // for "different amounts" modes — one entry per recipient
  // tokenAddress: "0x...", // for token modes — the ERC20 contract address
};
```

**3. Run the client:**
```sh
npm run client
```

For ERC20 token modes, the client automatically checks the token allowance and sends an approval transaction if needed before executing the batch transfer.
