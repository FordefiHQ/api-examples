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

## Contract verification examples

### On Etherscan
```bash
forge verify-contract \
  --rpc-url https://ethereum.publicnode.com \
  --verifier etherscan \
  --verifier-url 'https://api.etherscan.io/api' \
  --etherscan-api-key YOUR_ETHERSCAN_API_KEY \
  CONTRACT_ADDRESS \
  src/Batcher.sol:BatchTransfer
```

### On Basescan:
```bash
forge verify-contract \
  --rpc-url https://mainnet-preconf.base.org \
  --verifier etherscan \
  --verifier-url 'https://api.basescan.org/api' \
  --etherscan-api-key YOUR_BASESCAN_API_KEY \
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

### Example: Batch Send USDC on Base

Here's how to use the deployed BatchTransfer contract to send USDC to multiple recipients:

⚠️ This smart contract has not been formally audited and should NOT be used in a production setting, use at your own risks!

**Prerequisites:**
- USDC Contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Your deployed BatchTransfer contract address
- Sufficient USDC balance in your wallet

**Step 1: Approve USDC Spending**
```javascript
// IMPORTANT: First approve the BatchTransfer contract to spend your USDC
const usdcContract = new ethers.Contract(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  ["function approve(address spender, uint256 amount) external returns (bool)"],
  signer
);

// Approve for 0.2 USDC total (200000 with 6 decimals)
await usdcContract.approve(
  "YOUR_BATCH_CONTRACT_ADDRESS",
  200000 // Total amount you plan to send
);
```

**Step 2: Execute Batch Transfer**
```javascript
const batchContract = new ethers.Contract(
  "YOUR_BATCH_CONTRACT_ADDRESS",
  ["function batchSendTokenSameAmount(address token, address[] calldata recipients, uint256 amountPerRecipient) external"],
  signer
);

// Send 0.1 USDC (100000) to 2 recipients
const recipients = [
  "0x742d35Cc6635C0532925a3b8D4f25e5b7d6C9e1a",
  "0x8ba1f109551bD432803012645Hac136c26C6A2e5"
];

await batchContract.batchSendTokenSameAmount(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC address
  recipients,                                    // Recipients array
  100000                                        // 0.1 USDC per recipient (6 decimals)
);
```

**Available Functions:**
- `batchSendTokenSameAmount()` - Send same amount to multiple recipients
- `batchSendTokenDifferentAmounts()` - Send different amounts to multiple recipients
- `batchSendETHSameAmount()` - Send same ETH amount to multiple recipients
- `batchSendETHDifferentAmounts()` - Send different ETH amounts to multiple recipients

## Troubleshooting

If you encounter errors:
1. Verify all environment variables are properly set
2. Ensure your Fordefi vault has sufficient funds for deployment
3. Check that your private key file is correctly formatted and accessible
4. Verify the contract was compiled successfully (`out` directory should contain your contract artifacts)
5. Make sure the chainId and RPC URL match your target network
6. Check that the artifact path in `deploy.ts` matches your contract name