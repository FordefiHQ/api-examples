# Solana Gas Station with Fordefi

A TypeScript tool for executing Solana SPL token transfers using multiple vault signatures through the Fordefi API and the Gill Solana library. This tool demonstrates a "gas station" pattern where one vault pays transaction fees while another vault provides the tokens.

## Overview

This tool creates a two-step signing process:
1. **Fee Payer Vault**: Signs the transaction to cover network fees
2. **Source Vault**: Signs the transaction to authorize token transfer

The transaction transfers SPL tokens from a source vault to a destination address, with fees paid by a separate fee payer vault.

## Prerequisites

- **Fordefi organization and Solana vaults**: You need access to a Fordefi organization with at least two Solana vaults
- **Node.js and npm installed**: Version 16 or higher recommended
- **Fordefi credentials**: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))
- **TypeScript setup**:
  ```bash
  # Install TypeScript and type definitions
  npm install typescript --save-dev
  npm install @types/node --save-dev
  npm install tsx --save-dev
  
  # Initialize a TypeScript configuration file (if not already done)
  npx tsc --init
  ```

## Installation

1. **Clone or navigate to the project directory**:
   ```bash
   cd solana-gas-station-gill
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create the secret directory**:
   ```bash
   mkdir -p secret
   ```

4. **Add your private key**: Place your API User's private key in PEM format at `secret/private.pem`

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Fordefi API Configuration
FORDEFI_API_TOKEN=your_fordefi_api_token_here

# Vault Configuration
ORIGIN_VAULT=vault_id_containing_tokens_to_transfer
ORIGIN_ADDRESS=public_address_of_origin_vault

# Destination Configuration  
DESTINATION_ADDRES=destination_public_address_for_tokens

# Fee Payer Configuration
FEE_PAYER_ADDRESS=public_address_of_fee_payer_vault
FEE_PAYER_VAULT=vault_id_that_will_pay_transaction_fees
```

### Configuration Details

- **FORDEFI_API_TOKEN**: Your Fordefi API access token
- **ORIGIN_VAULT**: The vault ID that contains the tokens you want to transfer
- **ORIGIN_ADDRESS**: The public address (base58) of the origin vault
- **DESTINATION_ADDRES**: The public address where tokens will be sent
- **FEE_PAYER_ADDRESS**: The public address of the vault that will pay transaction fees
- **FEE_PAYER_VAULT**: The vault ID that will pay for transaction fees

### Token Configuration

The tool is pre-configured to transfer USDC tokens. You can modify the token settings in `src/config.ts`:

```typescript
tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
decimals: 6n,
amount: 1_000n, // 1 USDC = 1_000_000n (including decimals)
```

## Usage

### Running the Tool

Execute the main script to perform a token transfer:

```bash
npm run gas
# or
npx tsx src/run.ts
```

### What Happens

1. **Transaction Creation**: Creates a SPL token transfer transaction using the Gill library
2. **Fee Payer Signing**: Submits the transaction to Fordefi for partial signature by the fee payer vault
3. **Source Vault Signing**: Takes the partially signed transaction and submits it for final signature by the source vault
4. **Transaction Broadcast**: The fully signed transaction is automatically broadcast to the Solana network
5. **Explorer Link**: Provides a Solana Explorer link to view the transaction

### Expected Output

```
Payload signed 🖋️✅ -> [signature]
Submitting transaction to Fordefi for partial signature 🔑
Payload signed 🖋️✅ -> [signature]  
Submitting transaction to Fordefi for 2cd signature 🔑🔑
Transaction fully signed and submitted to network ✅
Final transaction ID: [transaction_id]
https://explorer.solana.com/tx/[transaction_hash]
```

## Project Structure

```
solana-gas-station-gill/
├── src/
│   ├── config.ts           # Fordefi configuration and environment variables
│   ├── run.ts              # Main execution script
│   ├── serialize-spl.ts    # Transaction building and serialization
│   ├── process_tx.ts       # Fordefi API interaction
│   └── signer.ts           # Utilities for signing your transaction with your API User's private key
├── secret/
│   └── private.pem         # Your API signer private key (create this)
├── package.json
├── tsconfig.json
└── .env                    # Environment configuration (create this)
```

## Support

For issues related to:
- **Fordefi API**: Check the [Fordefi documentation](https://docs.fordefi.com/developers/api-overview)
- **Solana transactions**: Refer to [Solana documentation](https://docs.solana.com/)
- **Gill library**: Check the [Gill library documentation](https://github.com/DecalLabs/gill) 