# Batcher Program

Anchor v1.0 Solana program that batches multiple SPL token transfers into a single transaction. Deployed to devnet at `BTCH6Wx6XdS8epLM4qZtuLeUebvBCzVPS4WAcQgPQw6t`.

## Instructions

### `batch_transfer_same_token`

Transfers a single token from one sender to up to **22 recipients** in one transaction.

| Account             | Type          | Description                        |
|---------------------|---------------|------------------------------------|
| `sender`            | Signer, Mut   | Wallet initiating the transfers    |
| `sender_token_account` | Mut        | Sender's token account (ATA)       |
| `token_program`     | Program       | SPL Token program                  |
| **remaining accounts** | Mut each   | One destination ATA per recipient  |

**Args:** `amounts: Vec<u64>` — one amount per recipient (must match remaining account count).

### `batch_transfer_multi_token`

Transfers across **different mints** (supports both Token and Token-2022) to up to **10 recipients**.

| Account   | Type        | Description                     |
|-----------|-------------|---------------------------------|
| `sender`  | Signer, Mut | Wallet initiating the transfers |

Remaining accounts are passed in **groups of 4** per transfer:

| Index | Account             | Type    |
|-------|---------------------|---------|
| 0     | Source token account | Mut     |
| 1     | Dest token account   | Mut     |
| 2     | Mint                 | ReadOnly|
| 3     | Token program        | ReadOnly|

**Args:** `amounts: Vec<u64>` — one amount per transfer (remaining accounts must be `amounts.len() * 4`).

## App Usage

The TypeScript client lives in `app/` and uses `@solana/kit` (web3.js v2) with a Codama-generated SDK.

### Scripts

```bash
cd app

# Same-token batch via Fordefi MPC wallet
npm run batch

# Multi-token batch via Fordefi MPC wallet
npm run multi-batch
```

### Fordefi Integration

Signing goes through [`@solana/keychain-fordefi`](https://github.com/solana-foundation/solana-keychain/tree/main/typescript/packages/fordefi), a Kit signer for your Fordefi vault (created in `app/fordefi/signer.ts`). It is set as the transaction's fee payer and the batch's sender, and when Kit signs the message it signs the API request with your API User key, submits the transaction to Fordefi, waits for the MPC signature and verifies it.

`push_to_custom_url` in `app/config.ts` picks the push mode:

- `false`: auto push mode. Fordefi signs and broadcasts the transaction.
- `true`: manual push mode. Fordefi signs without broadcasting and the script sends the transaction to `RPC_URL`. Fordefi may refresh the blockhash and priority fee before signing, so the script always broadcasts the transaction Fordefi returns.

Credentials are shared by all solana-kit examples: set `FORDEFI_API_TOKEN`, `FORDEFI_VAULT_ID` and `FORDEFI_VAULT_ADDRESS` in `solana-kit/.env` and put your API User private key at `solana-kit/secret/private.pem` (see the [shared setup](../README.md)).

### Client tests

```bash
cd app
npm test
```

The tests run both scripts against a mock Fordefi API and a mock Solana RPC, both backed by [LiteSVM](https://github.com/LiteSVM/litesvm). No credentials or funds are needed and nothing is sent to the network. They check the requests the signer sends to Fordefi in both push modes and that the broadcast transaction carries a valid vault signature over the message Fordefi returned. The compiled program isn't checked in, so they don't execute the batch instruction itself: the transaction passes signature verification and then stops at the missing program.

## Build & Test

```bash
anchor build              # Compile program → target/deploy/
cargo test                # Run LiteSVM tests (requires anchor build first)
cargo test <test_name>    # Run a single test
```

## Toolchain

- Rust 1.89.0 (`rust-toolchain.toml`)
- Anchor CLI 1.0 / `anchor-lang = "1.0.0"`
- Node + npm (for `app/`)
