# Solana Batch Token Transfers

A tool for creating atomic batches of SPL token transfers using the Solana Kit library's [transaction planner and executor features](https://www.solanakit.com/docs/concepts/instruction-plans).

## Overview

This example demonstrates how to batch multiple token transfer instructions into a single atomic transaction. Using Solana Kit's `transactionPlanner` and `transactionExecutor`, we can:

- Create multiple ATA (Associated Token Account) instructions
- Bundle multiple token transfers into one transaction
- Execute the batch atomically (all-or-nothing)
- Broadcast to any Solana RPC endpoint

## How It Works

1. **Transaction Planning** (`tx-planner.ts`): Builds instruction sets for creating ATAs and transferring tokens to multiple destinations
2. **Transaction Execution** (`run.ts`): Signs each planned transaction via Fordefi and broadcasts it via any custom RPC endpoint

Signing goes through [`@solana/keychain-fordefi`](https://github.com/solana-foundation/solana-keychain/tree/main/typescript/packages/fordefi), a Kit signer for your Fordefi vault: it signs the API request with your API User key, submits the transaction to Fordefi, waits for the MPC signature and verifies it before handing it back to Kit. The signer runs in Fordefi's manual push mode, so Fordefi signs without broadcasting and the plan executor sends each transaction to your RPC. Fordefi may refresh the blockhash and priority fee before signing, so the executor always broadcasts the transaction Fordefi returns.

## Usage

Credentials are shared by all solana-kit examples: put your API User private key at `solana-kit/secret/private.pem` and these variables in `solana-kit/.env` (see the [shared setup](../README.md)):

```env
FORDEFI_API_TOKEN=your_api_token
FORDEFI_VAULT_ID=your_solana_vault_id
FORDEFI_VAULT_ADDRESS=your_solana_vault_address
DESTINATION_ADDRESS=first_recipient_address
DESTINATION_ADDRESS_2=second_recipient_address
```

Configure the mint and amount in `src/config.ts`, then run the batch transfer:

```bash
npm install
npm run plan
```

All instructions execute atomically - if any instruction fails, the entire transaction reverts.

## Testing

```bash
npm test
```

The tests run `src/run.ts` against a mock Fordefi API and a mock Solana RPC, both backed by [LiteSVM](https://github.com/LiteSVM/litesvm). No credentials or funds are needed and nothing is sent to the network. They check the requests the signer sends to Fordefi and that both token transfers execute (USDG, a Token-2022 mint).
