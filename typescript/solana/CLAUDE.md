# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fordefi API example scripts for Solana, organized by Solana SDK. Each subdirectory under a SDK folder is a standalone Node.js project with its own `package.json`, `.env`, and `secret/` directory. There is no monorepo tooling—each example is independent.

## Running Examples

Each example is a standalone project. To run one:

```bash
cd <sdk>/<example>        # e.g. solana-kit/spl-transfer
npm install
npm run <script>          # script name varies per project, check package.json
```

Common script runners: `tsx` (solana-kit, gill examples) and `ts-node` (web3.js, orca examples).

## SDK Organization

- **`web3.js/`** — Legacy `@solana/web3.js` v1 examples (Jupiter, Raydium, Marinade, Exponent, batch transfers)
- **`solana-kit/`** — Modern `@solana/kit` v2+ examples (SPL transfers, Orca DEX, batch transfers, staking, Anchor program deployment, Fragmetric)
- **`gill/`** — `gill` SDK examples (SPL transfers, sponsored transactions, gas station)
- **`dev/`** — Development/experimental scripts (gas station, Jito integration)

## Common Architecture Pattern

Every example follows the same flow:

1. **`config.ts`** — Loads `.env` vars and `secret/private.pem`, exports typed config objects (`FordefiSolanaConfig` + protocol-specific config)
2. **`serialize-*.ts` / `serializers/`** — Builds Solana transaction instructions and serializes to base64 for Fordefi's `solana_serialized_transaction_message` API
3. **`signer.ts`** — Signs the API request payload with the API Signer's private key (SHA256 + RSA)
4. **`process_tx.ts`** — Posts signed payload to `https://api.fordefi.com/api/v1/transactions`, polls for MPC signature completion
5. **`run.ts`** (entry point) — Orchestrates the above: serialize → sign → submit → optionally push to Jito

The Fordefi API request body always looks like:
```json
{
  "vault_id": "...",
  "signer_type": "api_signer",
  "sign_mode": "auto",
  "type": "solana_transaction",
  "details": {
    "type": "solana_serialized_transaction_message",
    "push_mode": "auto",
    "chain": "solana_mainnet",
    "data": "<base64-encoded-transaction>"
  }
}
```

## Key Conventions

- Transactions use `createNoopSigner` (solana-kit) since Fordefi handles actual signing via MPC
- `push_mode` is `"manual"` when using Jito for bundle submission, `"auto"` otherwise
- API request signing: `payload = "${apiPath}|${timestamp}|${requestBody}"`, signed with RSA private key
- Each project expects a `secret/private.pem` file (API Signer key) and `.env` with `FORDEFI_API_TOKEN`, `ORIGIN_VAULT`, `ORIGIN_ADDRESS`, `DESTINATION_ADDRES` (note: typo is in the codebase)
- solana-kit examples build transactions with `kit.pipe(createTransactionMessage → setFeePayer → setBlockhash → appendInstructions)`
- Batch/deploy examples use `kit.createTransactionPlanner` with `nonDivisibleSequentialInstructionPlan` for auto-splitting large instruction sets

## Jito Integration

Several examples support optional Jito bundle submission (priority landing). When enabled, `push_mode` is set to `"manual"`, and after Fordefi signs, the raw transaction is sent to Jito's block engine. Relevant utilities: `push_to_jito.ts`, `get_jito_tip_account.ts`, `get_priority_fees.ts`.
