# Fragmetric Restaking with Fordefi

Helper code that automates SOL restaking to fragSOL using the Fragmetric protocol and Fordefi.

## Overview

This tool allows you to:
- Restake SOL tokens to fragSOL using the Fragmetric protocol
- Use Fordefi's secure vault system for transaction signing
- Automatically handle transaction serialization and submission to Solana mainnet

Signing goes through [`@solana/keychain-fordefi`](https://github.com/solana-foundation/solana-keychain/tree/main/typescript/packages/fordefi), a Kit signer for your Fordefi vault: it signs the API request with your API User key, submits the transaction to Fordefi, waits for the MPC signature and verifies it. The signer runs in Fordefi's auto push mode, so Fordefi broadcasts the transaction.

## Prerequisites

- Fordefi organization and Solana vault
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

## Installation

1. Clone or navigate to the project directory:
```bash
cd fragmetric
```

2. Install dependencies:
```bash
npm install
```

## Configuration

### Environment Variables

Credentials are shared by all solana-kit examples: put your API User private key at `solana-kit/secret/private.pem` and these variables in `solana-kit/.env` (see the [shared setup](../README.md)):

```env
# Fordefi API Configuration
FORDEFI_API_TOKEN=your_fordefi_api_token_here
FORDEFI_VAULT_ID=your_vault_id_here
FORDEFI_VAULT_ADDRESS=your_solana_vault_address_here
```

### Restaking Configuration

Modify the `fragmetricConfig` in `config.ts` to set your restaking parameters:

```typescript
export const fragmetricConfig: FragmetricConfig = {
  restakeAmount: 100n, // Amount in lamports (100 lamports = 0.0000001 SOL)
  assetMint: null      // null for SOL, or specify token mint address
};
```

## Usage

### Running the Restaking Process

Execute the restaking transaction:

```bash
npm run restake
```

This command will:
1. Build the deposit instructions using the Fragmetric SDK
2. Create a transaction message with your Fordefi vault as the fee payer and signer
3. Sign it through the Fordefi signer, which submits it to Fordefi, waits for the MPC signature and lets Fordefi broadcast it
4. Print the transaction signature

## Testing

```bash
npm test
```

The test runs `run.ts` against a mock Fordefi API and a mock Solana RPC, both backed by [LiteSVM](https://github.com/LiteSVM/litesvm). No credentials or funds are needed and nothing is sent to the network. The Fragmetric SDK needs live mainnet state to build a deposit, so the test passes in a stand-in instruction instead. It checks the request the signer sends to Fordefi and that the transaction Fordefi broadcasts executes with a valid vault signature.

## Project Structure

```
fragmetric/
├── config.ts              # Configuration interfaces and Fordefi settings
├── run.ts                  # Main execution script, signs and sends with the Fordefi signer
├── serialize_restaking.ts  # Deposit instructions and transaction message
├── test/
│   ├── harness.ts         # Mock Fordefi API and Solana RPC backed by LiteSVM
│   └── run.test.ts        # Offline test of run.ts
├── package.json           # Project dependencies and scripts
└── README.md             # This file
```

## Configuration Details

### FordefiSolanaConfig Interface

Modify the `fordefiConfig` in `config.ts` to set your Fordefi parameters:

- `accessToken`: Your Fordefi API access token
- `vaultId`: The ID of your Solana vault in Fordefi
- `fordefiSolanaVaultAddress`: The public address of your Solana vault
- `privateKeyPem`: Pointer to your private key file
- `chain`: Fordefi chain ID, `solana_mainnet` or `solana_devnet`

### FragmetricConfig Interface
- `restakeAmount`: Amount to restake in lamports
- `assetMint`: Token mint address (null for native SOL)

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   Error: FORDEFI_API_TOKEN environment variable is not set
   ```
   - Ensure `solana-kit/.env` is properly configured

2. **Private Key Not Found**
   ```
   Error: ENOENT: no such file or directory, open '.../solana-kit/secret/private.pem'
   ```
   - Verify your private key is at `solana-kit/secret/private.pem` (or that `FORDEFI_PRIVATE_KEY_PATH` points to it)

3. **Transaction Failures**
   - Ensure your vault has sufficient SOL balance
   - Check that the vault address and ID are correct
