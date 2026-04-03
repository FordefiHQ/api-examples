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

Scripts in `app/fordefi/` handle signing through Fordefi's API:

1. Transaction is built without a blockhash (Fordefi adds it)
2. Serialized message is sent to Fordefi's API with a signed payload
3. Fordefi signs with its MPC vault and optionally broadcasts
4. The script polls until the transaction reaches `signed`/`mined` state

Configuration is loaded from environment variables — see `app/fordefi/config.ts` for required values (`FORDEFI_ACCESS_TOKEN`, `FORDEFI_VAULT_ID`, `FORDEFI_ORIGIN_ADDRESS`, etc.).

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
