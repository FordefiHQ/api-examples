# Solana Batch Token Transfers

A tool for creating atomic batches of SPL token transfers using the Solana Kit library's transaction planner and executor features.

## Overview

This example demonstrates how to batch multiple token transfer instructions into a single atomic transaction. Using Solana Kit's `transactionPlanner` and `transactionExecutor`, we can:

- Create multiple ATA (Associated Token Account) instructions
- Bundle multiple token transfers into one transaction
- Execute the batch atomically (all-or-nothing)
- Broadcast to any Solana RPC endpoint

## How It Works

1. **Transaction Planning** (`tx-planner.ts`): Builds instruction sets for creating ATAs and transferring tokens to multiple destinations
2. **Transaction Execution** (`process-tx.ts`): Signs and broadcasts the planned transaction via Fordefi

## Usage

Configure your settings in the config file, then run the batch transfer. All instructions execute atomically - if any instruction fails, the entire transaction reverts.
