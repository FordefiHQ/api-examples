# Fragmetric Restaking with Fordefi

Helper code that automates SOL restaking to fragSOL using the Fragmetric protocol and Fordefi.

## Overview

This tool allows you to:
- Restake SOL tokens to fragSOL using the Fragmetric protocol
- Use Fordefi's secure vault system for transaction signing
- Automatically handle transaction serialization and submission to Solana mainnet

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

3. Create the required secret directory and files:
```bash
mkdir -p secret
```

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Fordefi API Configuration
FORDEFI_API_TOKEN=your_fordefi_api_token_here
SOLANA_VAULT_ID=your_vault_id_here
SOLANA_VAULT_ADDRESS=your_solana_vault_address_here
```

### Private Key Setup

Place your Fordefi API private key in PEM format at:
```
./secret/private.pem
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
1. Create a restaking transaction using the Fragmetric SDK
2. Serialize the transaction for Solana
3. Sign the transaction request using your private key
4. Submit the transaction to Fordefi for execution
5. Wait for the transaction to be signed and executed

## Project Structure

```
fragmetric/
├── config.ts              # Configuration interfaces and Fordefi settings
├── run.ts                  # Main execution script
├── serialize_restaking.ts  # Transaction creation and serialization
├── utils/
│   ├── process_tx.ts      # Fordefi API interaction utilities
│   └── signer.ts          # Cryptographic signing utilities
├── secret/
│   └── private.pem        # Your private key (not in repository)
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
- `apiPathEndpoint`: Fordefi API endpoint for transaction creation

### FragmetricConfig Interface
- `restakeAmount`: Amount to restake in lamports
- `assetMint`: Token mint address (null for native SOL)

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   Error: FORDEFI_API_TOKEN environment variable is not set
   ```
   - Ensure your `.env` file is properly configured

2. **Private Key Not Found**
   ```
   Error: ENOENT: no such file or directory, open './secret/private.pem'
   ```
   - Verify your private key file exists

3. **Transaction Failures**
   - Ensure your vault has sufficient SOL balance
   - Check that the vault address and ID are correct
