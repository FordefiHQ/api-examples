# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fordefi API example scripts for Solana, organized by Solana SDK. Every subdirectory under an SDK folder is a standalone Node.js project with its own `package.json`, `.env`, and `secret/` directory. There is no monorepo tooling and no shared package — helpers like `process_tx.ts` and `signer.ts` are **copied** between projects, so a fix in one does not propagate. When changing a shared-looking helper, grep for its siblings and decide explicitly whether to replicate.

## SDK Organization

- **`solana-kit/`** — `@solana/kit` v2+ (the current default for new examples): `spl-transfer`, `batch`, `batcher-program`, `create-prefunded-account`, `deploy-program`, `fixed-delegation`, `fragmetric`, `gas-station`, `orca`, `staking`
  - Every project in this folder is on `@solana/kit ^8.2.0` with matching `@solana-program/*` clients **except** two, both held back by an upstream peer range: `fixed-delegation` stays on kit 7 because `@solana/subscriptions` (latest 0.5.0) peer-depends on `@solana/kit ^7.0.0`, and `orca` stays on kit 2 because `@orca-so/whirlpools` (latest 8.0.1) peer-depends on `@solana/kit ^5.0.0`. Keep new examples on kit 8: `@solana/keychain-fordefi` (2.x) peer-depends on `@solana/{signers,transactions,transaction-messages,addresses,keys,codecs-strings} >= 8.0.0`, which kit 8 satisfies through its own transitive deps.
- **`web3.js/`** — legacy `@solana/web3.js` v1: `batch`, `exponent`, `jupiter`, `marinade`, `raydium`
- **`gill/`** — `gill` SDK: `spl-transfer`, `spl-sponsored`

## Running Examples

Each project is independent: `cd <sdk>/<example> && npm install && npm run <script>`. Script names are inconsistent per project — the full map (check `package.json` if this drifts):

| Project | Script(s) |
| --- | --- |
| `solana-kit/spl-transfer` | `spl` |
| `solana-kit/batch` | `plan` |
| `solana-kit/gas-station` | `gas` |
| `solana-kit/staking` | `action` (behavior set by `ACTION` env var: `stake` \| `unstake` \| `withdraw`) |
| `solana-kit/create-prefunded-account` | `create` |
| `solana-kit/fixed-delegation` | `create-delegation`, `transfer`, `revoke` |
| `solana-kit/fragmetric` | `restake` |
| `solana-kit/deploy-program` | `deploy`, `close-buffer`, `build`, `clean`, `test`, `lint` |
| `solana-kit/orca` | `swap`, `open-position`, `increase-liquidity`, `remove-liquidity`, `harvest-position`, `close-position` |
| `solana-kit/batcher-program/app` | `batch`, `multi-batch` |
| `gill/spl-transfer`, `gill/spl-sponsored` | `spl` |
| `web3.js/jupiter` | `ultra` |
| `web3.js/raydium` | `swap`, `open-position`, `remove-liquidity`, `harvest` |
| `web3.js/marinade` | `marinade`, `check` |
| `web3.js/exponent` | `invest` |
| `web3.js/batch` | `tx` |

Script runners are mixed: `tsx` in newer projects (solana-kit, gill/spl-transfer, jupiter), `ts-node --project tsconfig.json` in older ones (orca, raydium, marinade, exponent, fragmetric, gill/spl-sponsored, web3.js/batch).

## Tests

Only the two on-chain program projects have tests:

```bash
# solana-kit/batcher-program — LiteSVM (Rust), not Bankrun or anchor's JS runner
anchor build && cargo test
cargo test test_batch_transfer_same_token_success   # single test
# tests include_bytes! the compiled .so — always anchor build after program changes

# solana-kit/deploy-program — anchor test (ts-mocha, per Anchor.toml)
anchor build && anchor test
npx tsx scripts/generate-clients.ts   # regenerate Codama client from target/idl/ after program changes
```

The other 16 projects have no test infrastructure — validation is running the script against devnet/mainnet.

## Core Flow

Every example converges on the same shape, split across `config.ts` → `serialize-*.ts` → `signer.ts` → `process_tx.ts` → entry point:

1. Build instructions with the SDK, using `createNoopSigner(vaultAddress)` for any Fordefi-controlled signer — the vault's key lives in MPC and cannot sign locally.
2. Compile the message and base64-encode **`messageBytes`, not the full transaction**. The API field is `solana_serialized_transaction_message`; sending wire-format bytes fails.
3. Sign the API request (not the Solana tx) with the API User's RSA key: `payload = "${apiPathEndpoint}|${timestamp}|${requestBody}"`, SHA256 + RSA.
4. `POST https://api.fordefi.com/api/v1/transactions` with `Authorization: Bearer`, `x-signature`, `x-timestamp` headers.
5. Poll `GET /api/v1/transactions/{id}` until state is `signed` / `pushed` / `mined`, then read `raw_transaction`.

Request body:

```json
{
  "vault_id": "...", "signer_type": "api_signer", "sign_mode": "auto",
  "type": "solana_transaction",
  "details": {
    "type": "solana_serialized_transaction_message",
    "push_mode": "auto",
    "chain": "solana_mainnet",
    "data": "<base64 messageBytes>",
    "signatures": [{ "data": null }]
  }
}
```

### push_mode

`"auto"` means **Fordefi broadcasts** — do not re-broadcast, preflight will fail once the tx has landed (see the comment in `create-prefunded-account/utils/fordefi-submit.ts`). Derive the signature from the returned `raw_transaction` instead. `"manual"` means something other than Fordefi owns broadcasting, which happens for four different reasons: Jito bundle submission, a plan executor pushing to a custom RPC (`batch`, `deploy-program`), the intermediate round of a multi-signature flow (`gas-station`), and handing the signed tx to a protocol's own submit endpoint (`jupiter` posts it to Jupiter's `/execute`).

### The signatures array

For multi-signer transactions, `details.signatures` is **positionally ordered** and must line up with the compiled message's signer order: `{ data: null }` is the placeholder Fordefi fills with the vault's MPC signature, and locally-produced signatures go in as base64. `create-prefunded-account/utils/fordefi-submit.ts` and `deploy-program/src/signers.ts` build this by `unshift`-ing the null at the fee-payer position and pushing the rest — reuse that logic rather than reimplementing it.

## Signing Topologies

Beyond the single-vault base case, five variants exist and are the main thing to understand before modifying an example:

- **Two-vault co-signing** (`solana-kit/gas-station`) — a fee-payer vault pays while a source vault authorizes. Two sequential API round-trips: first request has `push_mode: "manual"` and `signatures: [{data:null},{data:null}]`; the returned `raw_transaction` is decoded, its signatures re-serialized, and submitted again under the source vault's `vault_id` with `push_mode: "auto"`. Note it also rewrites `READONLY_SIGNER` → `WRITABLE_SIGNER` account roles on the token instruction, and resolves the token program from the mint's owner so Token-2022 mints work.
- **Vault + local keypair** (`solana-kit/create-prefunded-account`) — a third-party keypair signs locally via `partiallySignTransactionMessageWithSigners`; the vault slot stays null.
- **Transaction planner/executor** (`solana-kit/batch`, `solana-kit/deploy-program`) — `createTransactionPlanner` + `nonDivisibleSequentialInstructionPlan` auto-splits oversized instruction sets, and `createTransactionPlanExecutor` calls Fordefi per transaction. Blockhash is attached at signing time, not plan time. `deploy-program` wraps this in a 3-attempt retry on `Blockhash not found`.
- **Delegator/delegatee** (`solana-kit/fixed-delegation`) — two vaults with distinct roles via `@solana/subscriptions` PDAs; the delegatee signs the transfer against a delegation the delegator created.
- **Sponsored / Octane** (`gill/spl-sponsored`, plus `dev/octane-helper.ts` in `solana-kit/spl-transfer` and `staking`) — hand-assembles the Solana wire format (`[num_sigs u8][sigs 64B each][message]`) and base58-encodes it for Octane, because the relayer wants a full transaction rather than a message.

## Config and Secrets

`config.ts` (at `src/config.ts` or project root, varies) loads `.env` plus the PEM and exports typed config objects. Behavior is driven by editing this file — mints, amounts, `useJito`, tips, and RPC URLs are usually hardcoded constants there, not env vars.

Env var names are standardized across every project in this tree. **Use these names in new examples; do not reintroduce a per-project spelling.**

| Var | Holds |
| --- | --- |
| `FORDEFI_API_TOKEN` | API User access token |
| `FORDEFI_VAULT_ID` | UUID of the primary signing vault |
| `FORDEFI_VAULT_ADDRESS` | base58 on-chain address of that vault |
| `DESTINATION_ADDRESS` / `_2` | recipient address(es), not vaults |

Where a second vault has a distinct role, it takes a prefixed pair on the same `_VAULT_ID` / `_VAULT_ADDRESS` shape: `FEE_PAYER_VAULT_ID` / `FEE_PAYER_VAULT_ADDRESS` (gas-station), `DELEGATOR_*` and `DELEGATEE_*` (fixed-delegation). Protocol-specific extras keep their own names: `ACTION`, `VALIDATOR_ADDRESS`, `STAKE_ACCOUNT_ADDRESS` (staking), `ORCA_POSITION_MINT_ADDRESS`, `JUPITER_API_KEY`, `SOLANA_CLUSTER`.

The `_ID` / `_ADDRESS` suffix is the whole point of the convention — a vault ID is a Fordefi UUID and a vault address is base58, and the two are not interchangeable in a request body. `vault_id` in the API payload always takes the UUID.

Note the TypeScript **field** names these map onto are still inconsistent (`originVault`, `vaultId`, `deployerVaultId`, `fordefiSolanaVaultAddress` all appear). Only the env var names were unified; don't assume a field name from the env var.

The PEM path is `./secret/private.pem` everywhere **except** `deploy-program` and `web3.js/marinade`, which use `./fordefi_secret/private.pem`. Paths are relative to the project root, so scripts must be run from there.

No `.env.example` files exist in this tree; derive required vars from `config.ts`.

## Chains

`chain` is `solana_mainnet` in most examples; `deploy-program` and `batcher-program` target `solana_devnet`. Default RPC is the public `api.mainnet-beta.solana.com`, which rate-limits aggressively — expect to swap in a private RPC in `config.ts` for anything batch-sized.

## Jito

Optional priority landing in `solana-kit/spl-transfer`, `solana-kit/orca`, and `web3.js/raydium`. Enabled via a `useJito` boolean in config, which flips `push_mode` to `"manual"`; after Fordefi signs, `push_to_jito.ts` fetches `raw_transaction` and posts it to `mainnet.block-engine.jito.wtf`. Supporting utils: `get_jito_tip_account.ts`, `get_priority_fees.ts`, `get_cu_limit.ts`. `web3.js/jupiter` also has Jito helpers under `bin/`, but that whole directory is abandoned Meteora scratch code: nothing in `src/` imports it, its relative import paths don't resolve, and it needs `@meteora-ag/dlmm`, which isn't a declared dependency. Don't treat `bin/` as a working reference or try to repair it incidentally.

## Nested CLAUDE.md

`solana-kit/batcher-program/CLAUDE.md` covers the Anchor v1.0 batching program (on-chain instruction limits, LiteSVM tests, Codama client). Its "TypeScript client" section is stale — it references an `app/run.ts` local-keypair script and an `npm run fordefi-batch` script that no longer exist; the real scripts are `batch` and `multi-batch`.
