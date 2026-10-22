# Raw EVM Contract Deployment with Fordefi

Compiles `Counter.sol` with Foundry and deploys it from a Fordefi EVM vault using raw Fordefi API calls.

## Overview

This example shows **low-level direct API integration** with Fordefi for contract deployment:

1. `forge build` compiles [src/Counter.sol](src/Counter.sol) into `out/Counter.sol/Counter.json`
2. The script reads the creation bytecode from that artifact
3. It sends an `evm_raw_transaction` with no `to` field (contract creation), the bytecode as `hex_data`, and a `custom_nonce`
4. The request is signed with your API User private key and submitted to Fordefi

## Prerequisites

- Fordefi organization and EVM vault
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (`forge`)
- Node.js and npm installed
- Fordefi credentials: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the following variables:

   ```env
   FORDEFI_API_USER_TOKEN=your_access_token
   VAULT_ID=your_vault_id
   VAULT_ADDRESS=your_sender_address
   CUSTOM_NONCE=your_deployment_nonce
   ```

3. Create a `./secret` folder and place your API User's `private.pem` private key file in the folder.

## Configuration

Edit [config.ts](config.ts):

```typescript
export interface DeployParams {
  evmChain: string;                 // Target chain (e.g., "ethereum", "arbitrum", "base")
  artifactPath: string;             // Foundry artifact holding the creation bytecode
  custom_nonce: string;             // Nonce for the deployment tx, as a decimal string
  gas_limit: string;                // Maximum gas units for the deployment
  max_fee_per_gas: string;          // Maximum fee per gas unit in wei (EIP-1559)
  max_priority_fee_per_gas: string; // Priority fee in wei (EIP-1559)
}
```

**About `custom_nonce`:**

- It is read from the `CUSTOM_NONCE` env variable and must be a string of digits (for example `42`)
- It must equal either the vault's next nonce, or the nonce of a transaction from the same vault that is already signed but not yet mined (to replace it)
- Remove it from the payload if you want Fordefi to pick the nonce automatically

## Usage

1. Ensure that your API Signer is running
2. Build and deploy:

   ```bash
   npm run deploy
   ```

   This runs `forge build` and then submits the deployment to Fordefi.
