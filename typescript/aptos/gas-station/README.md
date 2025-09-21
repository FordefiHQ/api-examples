# Aptos Gas Station with Fordefi & Geomi Integration

This example demonstrates how to use Fordefi's secure vault infrastructure together with [Geomi's Gas Station](https://geomi.dev/) to sponsor transaction fees on the Aptos blockchain.

## Overview

The integration works by:
1. **Transaction Creation**: Building an Aptos transaction using the Fordefi vault as the sender
2. **Secure Signing**: Leveraging Fordefi's MPC infrastructure to sign the transaction with enterprise-grade security
3. **Gas Sponsorship**: Using Geomi's Gas Station to sponsor the transaction fees, removing user friction
4. **Submission**: Broadcasting the sponsored transaction to the Aptos network

## Architecture

```
User Transaction → Fordefi Vault (MPC Signing) → Geomi Gas Station (Fee Sponsorship) → Aptos Network
```

## Prerequisites

- Node.js (v16 or higher)
- Fordefi account with an Aptos vault
- Geomi Gas Station API key
- Fordefi API User access token
- Fordefi API User private key (PEM format)
- Fordefi API Signer configured ([documentation](https://docs.fordefi.com/developers/program-overview))

## Setting Up Geomi Gas Station

1. **Create a Gas Station** at [Geomi](https://geomi.dev/)
   - Select your network (Testnet/Mainnet)

2. **Configure Allowed Contracts** (must match the transaction functions):
   - Add `0x1::fungible_asset` with `transfer` function allowed
   - Add `0x1::primary_fungible_store` with `transfer` function allowed
   
3. **Obtain Credentials**:
   - Generate an API key from the Gas Station dashboard
   - Copy the fee payer address (e.g., `0x6ad7...fccad`)
   - Fund the fee payer address with APT coins for sponsoring transactions

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `secret` directory and add your private key:
```bash
mkdir secret
# Add your Fordefi private key as private.pem in the secret directory
```

3. Create a `.env` file with your credentials:
```env
API_USER_ACCESS_TOKEN=your_fordefi_api_user_access_token
GAS_STATION_API_KEY=your_geomi_gas_station_api_key
```

## Configuration

Update the `src/config.ts` file with your specific details:

```typescript
export const fordefiConfig: FordefiAptosConfig = {
    accessToken: process.env.API_USER_ACCESS_TOKEN!,
    originVaultId: "your-fordefi-vault-id",
    originAddress: "your-fordefi-vault-address", 
    destAddress: "destination-address",
    sponsor: "your-geomi-gas-station-address",
    sponsor_api_key: process.env.GAS_STATION_API_KEY!,
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
    apiPathEndpoint: '/api/v1/transactions',
    asset: '0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832', // Testnet USDC
    decimals: 6n,
    amount: 1n,
};
```

## Usage

Run the gas station example:

```bash
npm run call
```

## How It Works

### 1. Transaction Building (`serializer.ts`)
- Creates an Aptos transaction using the official SDK
- Configures the transaction with fee payer support
- Simulates the transaction to ensure validity
- Serializes the transaction payload for Fordefi

### 2. Fordefi Integration (`process_tx.ts`, `signer.ts`)
- Signs the API request using the API User's private key
- Submits the transaction to Fordefi for MPC signing
- Polls for the completed signature
- Handles authentication and error management

### 3. Gas Station Integration (`serializer.ts`)
- Deserializes the signed transaction from Fordefi
- Uses Geomi's Gas Station Client to sponsor fees
- Submits the sponsored transaction to Aptos
- Returns the final transaction hash

### 4. Execution Flow (`run.ts`)
- Orchestrates the entire process
- Provides logging and status updates
- Handles timing and coordination between services

## Geomi Gas Station Benefits

[Geomi's Gas Station](https://geomi.dev/) provides:
- **Cost Efficient**: Save up to 90% versus blanket fee subsidies with smart rules
- **Customizable**: Define granular rules per wallet, function, or time window
- **Developer-Friendly**: Plug-and-play API with no smart contract changes needed
- **Built-in Protection**: reCAPTCHA, origin checks, and dashboard insights

## Support

- **Fordefi Documentation**: [Fordefi API Docs](https://docs.fordefi.com/developers/program-overview)
- **Geomi Documentation**: [Geomi Developer Docs](https://geomi.dev/)
- **Aptos Documentation**: [Aptos Developer Docs](https://aptos.dev/)
