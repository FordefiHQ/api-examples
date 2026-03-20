# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Standalone TypeScript example demonstrating NEAR chain operations (address derivation, transfers, staking, cross-chain swaps) using Fordefi's **black box signing**. Fordefi signs raw ED25519 hashes; the code builds NEAR transactions locally, sends the hash to Fordefi for signing, then assembles and broadcasts the signed transaction to the NEAR network.

## Commands

```bash
npm install              # install dependencies (uses tsx to run TypeScript directly)
npm run address          # derive NEAR implicit address from vault public key
npm run transfer         # transfer NEAR tokens to DESTINATION_ADDRESS
npm run stake            # stake NEAR with a validator pool
npm run intents          # cross-chain swap via NEAR Intents (1Click API)
```

No tests or linter configured.

## Configuration

- `.env` — Fordefi credentials (`FORDEFI_API_USER_TOKEN`, `BLACKBOX_VAULT_ID`, `VAULT_PUBLIC_KEY`), NEAR settings (`NEAR_ADDRESS`, `NEAR_NETWORK`, `DESTINATION_ADDRESS`, `STAKING_POOL_ID`), optional `ONECLICK_API_KEY`. See `.env.example`.
- `secret/private.pem` — API signer private key (never committed).
- `src/near-config.ts` — `transferAmount` and `stakeAmount` (in NEAR) are hardcoded here, not in `.env`.
- `src/intents/swap-config.json` — Swap parameters for intents flow: origin/destination tokens, human-readable amount, recipient, slippage. Also contains a `tokens` map that maps friendly keys (e.g. `near:mainnet:native`) to 1Click `assetId` values and decimals.

## Architecture

The transaction flow follows three steps, implemented across these modules:

1. **Build** — Serializer modules (`near-transfer-serializer.ts`, `near-staking-serializer.ts`) construct an unsigned NEAR transaction using `near-api-js`, serialize it, SHA256-hash it, and wrap the hash in a Fordefi `black_box_signature` payload.

2. **Sign via Fordefi** — Run modules (`near-transfer-run.ts`, `near-staking-run.ts`) sign the API request with the local PEM key (`signer.ts`), POST to Fordefi API (`process_tx.ts`), and receive a transaction ID.

3. **Broadcast** — `broadcast-near-transaction.ts` polls Fordefi for the completed signature, attaches it to the unsigned transaction to form a `SignedTransaction`, and broadcasts via NEAR JSON-RPC.

Supporting modules:
- `derive_near_address.ts` — converts a 32-byte ED25519 public key to a NEAR implicit address (hex) and `ed25519:base58` format.
- `interfaces.ts` — TypeScript interfaces for transfer, staking, and Fordefi response configs.
- `near-config.ts` — central config loader from env vars and `secret/private.pem`.

### Intents module (`src/intents/`)

Cross-chain swaps via [NEAR Intents 1Click API](https://1click.chaindefuser.com). Flow: resolve asset IDs from `/v0/tokens` → get quote → wrap NEAR if native → `storage_deposit` if needed → `ft_transfer` to 1Click deposit address → poll for completion.

- `intents-interfaces.ts` — types for 1Click API requests/responses (camelCase fields matching current API)
- `oneclick-api.ts` — REST client (quote, submit, poll, token listing with cache). Auth via `Authorization: Bearer` header. Status polling by `depositAddress`.
- `near-wrap-serializer.ts` — builds `near_deposit` call on `wrap.near` to wrap NEAR → wNEAR
- `intents-deposit-serializer.ts` — builds `ft_transfer` call to deposit tokens at 1Click address. Automatically adds `storage_deposit` if the deposit address is not registered on the token contract. Supports `nonceOverride` to avoid stale nonce after a preceding wrap TX.
- `near-intents-run.ts` — orchestrator: derives address, resolves asset IDs (supports legacy `chain:network:address` format from `.env` or direct 1Click `assetId`), quotes, wraps (if needed), deposits, polls. Passes nonce between wrap and deposit TXs to avoid nonce conflicts.

### Key patterns

- **Nonce management** — When multiple TXs are sent in sequence (e.g. wrap then deposit), the nonce from the first TX is incremented and passed to the next via `nonceOverride`, since the RPC may not have updated yet.
- **Storage registration** — Before `ft_transfer` to a new account, the deposit serializer checks `storage_balance_of` and batches a `storage_deposit` action in the same TX if needed.

## Key Details

- NEAR amounts use yoctoNEAR internally (1 NEAR = 10^24 yoctoNEAR). Conversion happens in the run modules.
- Uses CommonJS (`"type": "commonjs"`) with `near-api-js` loaded via dynamic `import()` for ESM compatibility.
- Staking calls the `deposit_and_stake` method on the validator pool contract with 300 TGas.
- Uses `near-api-js` v6.x for transaction construction, serialization, and RPC queries.

## Skills

This project includes skills that provide up-to-date API references and patterns. **Use these when building or modifying NEAR-related code** — they contain authoritative, tested information that may be more current than general training data.

| Skill | When to use |
|-------|-------------|
| `near-intents` | Modifying the intents module or integrating the 1Click API. Contains current request/response formats, required fields, and chain-specific deposit patterns. |
| `near-api-js` | Working with `near-api-js` for transaction construction, RPC queries, key management, or account operations. |
