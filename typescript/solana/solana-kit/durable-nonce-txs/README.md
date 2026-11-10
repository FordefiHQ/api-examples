# Durable Nonce Transactions with Fordefi + Solana Kit

Create a Solana [durable nonce](https://solana.com/docs/core/transactions/durable-nonces) account with [Fordefi](https://fordefi.com), then send a transfer whose lifetime is that nonce instead of a recent blockhash.

A regular Solana transaction expires ~1-1.5 minutes after its blockhash is chosen — a problem when signing (or policy approval) takes longer. A durable nonce transaction stores its "blockhash" in a nonce account on chain: the transaction stays valid until it is spent, no matter how long it takes to sign.

## Scripts

1. **`npm run create-nonce-account`** — submits Fordefi's native `solana_nonce_account_creation` transaction. Fordefi derives a new nonce account address, funds it with the rent-exempt minimum, sets the vault as the nonce authority, and broadcasts the transaction (`push_mode: auto`). It then lists the vault's nonce pool from `GET /api/v1/vaults/{id}/solana-nonce-accounts`.

2. **`npm run transfer`** — builds a SOL transfer message with Kit (fee payer = the vault, placeholder recent blockhash) and submits it unsigned as `solana_serialized_transaction_message`. Fordefi manages the nonce account: when a free one exists it replaces the blockhash with the stored durable nonce and prepends the `AdvanceNonceAccount` instruction before signing, so the transaction never expires. Do **not** reference the managed nonce account in your own message — that is rejected by the API; Fordefi attaches it for you. When no nonce account is free, Fordefi signs with a fresh recent blockhash instead. The script prints which nonce account was used and the on-chain signature.

Each spend advances the nonce, so the account returns to the pool and can be reused automatically.

## Prerequisites

1. **Fordefi API Setup**: Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
2. A Solana vault with enough SOL for the nonce account's rent-exempt minimum (~0.0015 SOL) plus the transfer amount.

## Installation

```bash
npm install
```

## Configuration

Credentials are shared by all solana-kit examples: put your API User private key at `solana-kit/secret/private.pem` and these variables in `solana-kit/.env` (see the [shared setup](../README.md)):

```env
FORDEFI_API_TOKEN=your_api_token
FORDEFI_VAULT_ID=your_solana_vault_id
FORDEFI_VAULT_ADDRESS=your_solana_vault_address
DESTINATION_ADDRESS=recipient_address
```

Edit `src/config.ts` to set the chain (both scripts must match) and, optionally:

```typescript
export const nonceConfig = {
  count: 1, // number of nonce accounts to create per run
};

export const transferConfig = {
  destinationAddress: process.env.DESTINATION_ADDRESS || "",
  // Must be at least the ~0.0009 SOL rent-exempt minimum when the recipient
  // account does not exist yet
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

Unit tests cover the nonce account data decoding (no network or credentials needed).
