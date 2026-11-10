# Durable nonce transactions with Fordefi and Solana Kit

Create a Solana [durable nonce](https://solana.com/docs/core/transactions/durable-nonces) account with [Fordefi](https://fordefi.com), then send a transfer that uses that nonce as its lifetime instead of a recent blockhash.

A regular Solana transaction expires about 150 blocks (roughly 1 to 1.5 minutes) after its blockhash is set. Fordefi sets the blockhash or durable nonce at the moment of signing, so approval time never causes expiration. A durable nonce removes the window that remains after signing. The signed transaction stays valid until the nonce is spent, so it doesn't expire if landing on chain takes longer than that.

## Scripts

1. `npm run create-nonce-account` submits Fordefi's native `solana_nonce_account_creation` transaction. Fordefi derives a new nonce account address, funds it with the rent-exempt minimum, sets the vault as the nonce authority, and broadcasts the transaction (`push_mode: auto`). The script then lists the vault's nonce pool from `GET /api/v1/vaults/{id}/solana-nonce-accounts`.

2. `npm run transfer` builds a SOL transfer message with Kit and submits it unsigned as `solana_serialized_transaction_message`. The vault is the fee payer, and the message carries a placeholder recent blockhash. Fordefi manages the nonce account. If the vault has a free nonce account, Fordefi replaces the blockhash with the stored durable nonce and prepends the `AdvanceNonceAccount` instruction before signing. If no nonce account is free, Fordefi signs with a fresh recent blockhash. The script prints which nonce account Fordefi used and the on-chain signature.

Don't reference the managed nonce account in your own message. The API rejects it, and Fordefi adds it for you.

Each spend advances the nonce, so the account returns to the pool and Fordefi reuses it on later transactions.

## Prerequisites

1. Complete the Fordefi [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker).
2. A Solana vault with enough SOL for the nonce account's rent-exempt minimum (about 0.0015 SOL) plus the transfer amount.

## Installation

```bash
npm install
```

## Configuration

All solana-kit examples share the same credentials. Put your API User private key at `solana-kit/secret/private.pem` and these variables in `solana-kit/.env` (see the [shared setup](../README.md)):

```env
FORDEFI_API_TOKEN=your_api_token
FORDEFI_VAULT_ID=your_solana_vault_id
FORDEFI_VAULT_ADDRESS=your_solana_vault_address
DESTINATION_ADDRESS=recipient_address
```

Edit `src/config.ts` to set the chain. Both scripts read the same value. You can also change these settings:

```typescript
export const nonceConfig = {
  count: 1, // number of nonce accounts to create per run
};

export const transferConfig = {
  destinationAddress: process.env.DESTINATION_ADDRESS || "",
  // If the recipient account doesn't exist yet, this must be at least
  // the rent-exempt minimum (about 0.0009 SOL)
  amountLamports: 1_000_000n, // 0.001 SOL
};
```

## Usage

```bash
npm run create-nonce-account
npm run transfer
```

## Testing

```bash
npm test
```

The unit tests cover nonce account data decoding and need no network access or credentials.
