# Marinade.finance SOL Staking for Fordefi Vaults

Helper code to enable SOL staking and unstaking with [Marinade.finance](https://marinade.finance) directly from a Fordefi Solana vault.

## Overview

Marinade offers liquid staking services for Solana. This repository contain codes to help you:

* Stake SOL from your Fordefi vault with Marinade
* Unstake SOL
* Check staking rewards and status

## Prerequisites

* Fordefi API user token and API Signer set up ([link to tutorial](https://docs.fordefi.com/developers/program-overview))
* Solana Vault in Fordefi
* SOL in your Fordefi vault (minimum 0.00228288 SOL / 2,282,880 lamports for staking)
* Node.js

## Setup

1. Create a Fordefi API user and API Signer ([tutorial](https://docs.fordefi.com/developers/program-overview))
2. Register your API User's key with your API Signer ([tutorial](https://docs.fordefi.com/developers/getting-started/pair-an-api-client-with-the-api-signer))
3. Clone this repository.
4. Run `npm install` to install all the dependencies.
5. Create a `.env` file in the root directory with the following variable:
   ```typescript
   FORDEFI_API_TOKEN="<your_api_user_token>" // Your Fordefi API User JWT
   VAULT_ID="<your_fordefi_solana_vault_id>"
   VAULT_ADDRESS="<your_fordefi_solana_vault_address>"
   ```
6. Place your your API User's `private.pem` private key in `./fordefi_secret/private.pem`


## Configuration

The application uses two main configuration files:

### `config.ts`

This file contains configuration for Fordefi connection and staking parameters:

```typescript
// Fordefi API configuration
export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

// Staking configuration
export const stakeWithMarinade: StakeWithMarinade = {
  solAmount: new BN('2282880'), // in lamports - minimum required amount
  direction: "stake" // or "unstake"
};
```

To modify the staking amount or direction (stake/unstake), edit the `stakeWithMarinade` object.

## Usage

First ensure that your API Signer is running:

```bash
docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
```

### Checking Rewards and Status

To check your current staking status and rewards:

```
npm run check
```

This will output:
- Your active stake accounts
- Your staking rewards

### Staking SOL

1. Configure `stakeWithMarinade.direction` in `config.ts` to `"stake"`
2. Set your desired amount in the `solAmount` field (minimum 2,282,880 lamports)
3. Run:
   ```
   npm run marinade
   ```

### Unstaking SOL

1. Configure `stakeWithMarinade.direction` in `config.ts` to `"unstake"`
2. Set your desired amount in the `solAmount` field
3. Run:
   ```
   npm run marinade
   ```

## Troubleshooting

- If you encounter errors related to minimum stake amount, ensure you're staking at least 2,282,880 lamports
- For API connection issues, verify your FORDEFI_API_TOKEN is correct