# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fordefi webhook handler examples — two Express.js (v5) servers in TypeScript that receive, verify, and respond to webhook events:

- **`webhooks_fordefi.ts`** — Receives Fordefi transaction events, verifies `X-Signature` header using ECDSA P-256. Read-only (no API calls).
- **`webhooks_audit_logs.ts`** — Audit-log security monitor. Receives Fordefi audit-log events on `POST /`, verifies `X-Signature`, and flags sensitive categories (policy, user_management, authentication, etc. — see `SENSITIVE_CATEGORIES`) as alerts logged to `live_logs/audit_alerts/`; other events go to `live_logs/audit/`. Admin routes: `GET /audit-logs` proxies `GET /api/v1/audit-log` (supports `page`, `size`, repeatable `category`, `created_after`, `created_before`), and `POST /replay/:recordId` re-delivers a record via `POST /api/v1/webhooks/trigger/audit-log/{id}`. Requires `FORDEFI_API_USER_TOKEN` (ADMIN or VIEWER role for the audit-log API).
- **`webhooks_hypernative.ts`** — Receives Hypernative alerts on two routes:
  - `/hypernative` (webhook actions) — verifies signature, triggers Fordefi transaction signing via API
  - `/hypernative/risk-insights` — verifies signature (different key), extracts victim contract address from alert details, executes emergency `remove_liquidity` via Fordefi web3 provider
  - `POST /` auto-routes between the two based on presence of `fordefi-transaction-id` header

## Commands

```bash
npm install              # install dependencies
npm run fordefi_server   # start Fordefi webhook server (npx tsx webhooks_fordefi.ts)
npm run audit_logs_server   # start audit-log security monitor (npx tsx webhooks_audit_logs.ts)
npm run hypernative_server  # start Hypernative webhook server (npx tsx webhooks_hypernative.ts)
npm run dev              # dev mode with nodemon (hypernative server)
npm run build            # tsc compile
```

## Architecture

ESM module (`"type": "module"` in package.json). TypeScript with `NodeNext` module resolution — all local imports use `.js` extensions.

### Signature Verification

Both servers use the same pattern: ECDSA P-256 signatures verified via Web Crypto API (`crypto.subtle`). DER-encoded signatures are converted to IEEE P1363 format using `@noble/curves`. The difference:
- Fordefi: signature in `X-Signature` header, verified against raw request body
- Hypernative: signature in `body.digitalSignature`, verified against `body.data` string

### fordefi-response/ Module

Used only by the Hypernative server for responding to events:
- `config.ts` — `FordefiProviderConfig` (vault address, chain ID, API token, signer key path)
- `get-provider.ts` — initializes `FordefiWeb3Provider`, waits for `connect` event
- `trigger-signing.ts` — calls `POST /api/v1/transactions/{id}/trigger-signing` on Fordefi API
- `abi-call.ts` — uses ethers.js to call `remove_liquidity` on a dynamically-extracted victim contract address

### Key Files

- `keys/fordefi_public_key.pem` — Fordefi webhook signature verification
- `keys/hypernative_public_key.pem` — Hypernative webhook action signature verification
- `keys/hypernative_public_key_2.pem` — Hypernative risk insight signature verification
- `fordefi-response/fordefi_secret/private.pem` — Fordefi API signer private key (gitignored)
- `.env` — `FORDEFI_API_USER_TOKEN` (required for Hypernative server)

### Victim Address Extraction

Risk insights parse `Suspected Victim <...|0xADDRESS>` from the alert's `details` field. If no address is found, the contract call is skipped gracefully.
