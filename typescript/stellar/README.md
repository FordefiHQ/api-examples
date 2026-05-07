# Stellar via Fordefi

TypeScript examples for creating Stellar transactions through the [Fordefi](https://docs.fordefi.com/developers/program-overview) API. Each example is a self-contained npm project; all three import a shared API client from [`fordefi/`](./fordefi).

| Example | Operation | Run |
|---|---|---|
| [`change-trust/`](./change-trust) | `stellar_change_trust` — establish a classic-asset trustline | `npm run trust` |
| [`claim-claimable-balance/`](./claim-claimable-balance) | `stellar_claim_claimable_balance` — claim claimable balances (auto-trustline if needed) | `npm run claim` |
| [`raw-transaction/`](./raw-transaction) | `stellar_raw_transaction` — submit a locally-built unsigned XDR | `npm run raw` |
| [`sign-message/`](./sign-message) | `stellar_message` — sign an arbitrary message (no broadcast) | `npm run sign` |

## Shared client

[`fordefi/`](./fordefi) holds the API client used by all three examples:

- `signer.ts` — RSA SHA256 signing of the Fordefi request payload (`path|timestamp|requestBody`)
- `interfaces.ts` — TypeScript types covering `CreateStellarTransactionRequest`, `CreateStellarMessageRequest`, asset identifiers, claim sources, dapp info, and the response shape
- `api-client.ts` — `createTransaction`, `getTransactionStatus`, `pollUntilComplete`, `submitTransaction`
- `index.ts` — barrel re-export

Each project imports it via relative path (`../../fordefi/index.js`).

## Per-project setup

The API User private key is shared across all four examples. Place it once at:

```text
stellar/fordefi/secret/private.pem
```

Then, inside each example directory:

```bash
npm install
cp .env.example .env          # then fill in tokens, vault id, asset/destination
```

See each project's README for the env vars it expects.

## Reference

- [`fordefi_api.json`](./fordefi_api.json) — full Fordefi OpenAPI spec (look for `CreateStellarChangeTrustRequest`, `CreateStellarClaimClaimableBalanceRequest`, `CreateStellarRawTransactionRequest`, `CreateStellarMessageRequest`)
- [Fordefi API docs](https://docs.fordefi.com/api/openapi)
- [Stellar SDK docs](https://stellar.github.io/js-stellar-sdk/)
