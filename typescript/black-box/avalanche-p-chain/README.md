# Avalanche P-Chain with Fordefi Black-Box Vault

P-Chain transfers and delegation staking using a Fordefi black-box vault (`key_type=ecdsa_secp256k1`).

## Prerequisites

- Node.js
- A Fordefi black-box vault — [docs](https://docs.fordefi.com/api/latest/openapi/vaults/create_vault_api_v1_vaults_post)
- A running Fordefi API Signer — [docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
- AVAX balance on P-Chain
- API Signer private key at `./secret/private.pem`

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
```

Required env vars:

| Variable | Purpose |
|---|---|
| `FORDEFI_API_USER_TOKEN` | API user bearer token |
| `BLACKBOX_VAULT_ID` | Vault ID for the black-box vault |
| `VAULT_PUBLIC_KEY` | 33-byte compressed secp256k1 pubkey (base64) — used to derive the P-Chain address |
| `DESTINATION_ADDRESS` | Recipient (transfers only) |
| `NODE_ID` | Validator to delegate to (staking only) |
| `REWARD_ADDRESS` | Optional reward target (staking only); defaults to the origin address |
| `AVALANCHE_NETWORK` | `mainnet` or `fuji` |
| `PCHAIN_RPC_URL` | `https://api.avax.network` or `https://api.avax-test.network` |

Tunables (transfer amount, stake amount, delegation window) live in `src/pchain-config.ts`. The defaults match Avalanche's 25 AVAX / 14-day minimums for delegation.

## Usage

```bash
npm run derive      # print the P-Chain address derived from VAULT_PUBLIC_KEY
npm run transfer    # AVAX transfer
npm run stake       # AddPermissionlessDelegatorTx
```

## How black-box signing works here

1. Build an unsigned tx locally with `@avalabs/avalanchejs` (`pvm.newBaseTx` for transfers, `pvm.newAddPermissionlessDelegatorTx` for staking).
2. SHA256 the full unsigned tx bytes, base64-encode, and POST to Fordefi as a `black_box_signature` payload.
3. Poll Fordefi until the tx is `completed`; it returns a 65-byte `[r|s|v]` signature (base64).
4. Wrap the signature as a single `Credential` (sufficient for single-key inputs covering the whole tx) and broadcast via `pvmApi.issueSignedTx`.

The Fordefi request itself is authenticated separately: `SHA256+RSA` over `${apiPath}|${timestamp}|${requestBody}` using the API user PEM key.

## Files

| File | Purpose |
|---|---|
| `pchain-config.ts` | Env loading and tunables |
| `pchain-address-utils.ts` | `SHA256 → RIPEMD160 → bech32("avax")` address derivation |
| `pchain-serializer.ts` | Shared: fetch UTXOs/feeState/context, hash unsigned tx, build Fordefi payload |
| `pchain-flow.ts` | Shared: derive address → build → sign API request → submit → poll → broadcast |
| `pchain-transfer-run.ts` / `pchain-staking-run.ts` | Thin entry points; supply the avalanchejs tx builder for each flow |
| `signer.ts` | RSA signing of Fordefi API requests |
| `process_tx.ts` | Fordefi API HTTP wrapper |
| `broadcast-pchain-transaction.ts` | Polls Fordefi, attaches signature, issues to P-Chain |
| `derive_avalanche_p_chain_address.ts` | Standalone address-derivation script |

## Notes

- Addresses use the format `P-avax1…` — the `P-` prefix is uppercase.
- Amounts on the wire are in **nAVAX** (1 AVAX = 1e9 nAVAX). `transferConfig.amountAvax` in `pchain-config.ts` is in AVAX and converted at the call site.
- `package.json` declares `"type": "commonjs"` while `@avalabs/avalanchejs` is ESM, so the avalanchejs import uses a memoized dynamic `import()` getter. Preserve this when adding new files.
