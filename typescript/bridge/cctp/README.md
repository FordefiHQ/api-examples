# CCTP Circle Bridge with Fordefi

Bridge USDC across chains using Circle's CCTP (Cross-Chain Transfer Protocol) with Fordefi.

## Overview

This repository contains three examples:

1. **EVM to EVM** - Bridge USDC between EVM chains (e.g., Arbitrum → Base)
2. **EVM to Solana** - Bridge USDC from EVM chains to Solana
3. **Solana to EVM** - Bridge USDC from Solana to EVM chains (e.g., Arbitrum)

Examples 1 & 2 use **Circle Bridge Kit**, which automatically handles the entire flow.
Example 3 implements the bridge manually using CCTP V2 contracts and Fordefi API for more control.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  EVM Chain  │────1───>│    Circle    │────2───>│ Destination │
│  (Burn)     │         │ (Attestation)│         │   (Mint)    │
└─────────────┘         └──────────────┘         └─────────────┘                               
```

## Prerequisites

### Setup

1. **Fordefi Credentials**:
   - Place your API user token in `.env` as `FORDEFI_API_USER_TOKEN`
   - Place your API user private key PEM file in `./fordefi_secret/private.pem`
   - Your API Signer must be setup and running (see here)[https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker]

2. **For EVM to Solana**: 
   - Set `PHANTOM_PK` environment variable with a Solana private key (used as relayer/payer)
   - This account only pays for the `receiveMessage` transaction on Solana
   - The actual USDC recipient is your Fordefi vault (set in `solanaRecipientAddress`)

3. **For Solana to EVM**:
   - Requires a Fordefi Solana vault with USDC
   - Set `fordefiVaultId` to your Fordefi Solana vault ID
   - Configure `solanaRecipientAddress` (your Fordefi Solana vault address)
   - Configure `evmRecipientAddress` (destination EVM address)

4. **Configuration** (`src/config.ts`):
   - Update source/destination chains
   - Set recipient addresses
   - Choose amount to bridge

### Transfer Speed Options

**Fast Transfer** (CCTP V2):
- ⚡ **~20 seconds**
- 💰 **0.01% fee**
- ✅ Recommended for most use cases

**Standard Transfer**:
- 🐢 **13-19 minutes** 
- 🆓 **FREE**
- 💼 Better for very large amounts

## How It Works

### Example 1: EVM to EVM Bridge

```typescript
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { getProvider } from './get-provider';

const kit = new BridgeKit();

// Create adapters for source and destination chains
const adapterFrom = await createAdapterFromProvider({
  provider: await getProvider(fordefiConfigFrom)
});

const adapterTo = await createAdapterFromProvider({
  provider: await getProvider(fordefiConfigTo)
});

// Bridge Kit handles everything: burn → attestation → mint
const result = await kit.bridge({
  from: { adapter: adapterFrom, chain: "Arbitrum" },
  to: { 
    adapter: adapterTo, 
    chain: "Base",
    recipientAddress: "0x..."
  },
  amount: "10",
});
```

### Example 2: EVM to Solana Bridge

```typescript
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createAdapterFromPrivateKey } from "@circle-fin/adapter-solana";

const kit = new BridgeKit();

// EVM side uses Fordefi provider
const evmAdapter = await createAdapterFromProvider({
  provider: await getProvider(fordefiConfig)
});

// Solana side uses a relayer private key (just for paying tx fees)
const solanaAdapter = createAdapterFromPrivateKey({
  privateKey: SOLANA_RELAYER_PRIVATE_KEY,
});

// Bridge Kit automatically:
// 1. Burns USDC on source chain (via Fordefi wallet)
// 2. Waits for Circle attestation (~20s with fast transfer)
// 3. Mints USDC to your Fordefi vault on Solana (relayer just pays the tx)
const result = await kit.bridge({
  from: { adapter: evmAdapter, chain: "Arbitrum" },
  to: {
    adapter: solanaAdapter,
    chain: "Solana",
    recipientAddress: "your-fordefi-solana-vault-address"
  },
  amount: "10",
});
```

**Note**: The relayer (Phantom PK) only pays for the Solana transaction. The USDC is minted to your Fordefi vault address specified in `recipientAddress`. The script automatically ensures the recipient's USDC token account exists before bridging.

### Example 3: Solana to EVM Bridge

This example demonstrates how to bridge USDC from Solana to an EVM chain (e.g., Arbitrum) using CCTP V2 contracts with Fordefi's remote signing capabilities.

**Flow**:
1. **Burn USDC on Solana** - Uses Fordefi's Solana vault to sign the `depositForBurn` transaction
2. **Wait for Circle Attestation** - Polls Circle's Iris API for attestation (~20s with fast transfer)
3. **Mint on Arbitrum** - Calls `receiveMessage` on Arbitrum's MessageTransmitter V2 contract

**Key Features**:
- Uses Fordefi API for remote transaction signing (no local private keys needed)
- Supports CCTP V2 with fast transfer (20 seconds) or standard (13-19 minutes)
- Automatic attestation polling with status updates
- Built-in recipient verification

**Configuration** (`src/config.ts`):
```typescript
export const bridgeConfigSolana: BridgeConfigSolana = {
  ethereumChain: "Arbitrum",        // Destination EVM chain
  amountUsdc: "0.1",                // Amount to bridge
  useFastTransfer: true,            // Fast (20s, 0.01% fee) vs Standard (free)
  solanaRpcUrl: "https://api.mainnet-beta.solana.com",
  solanaRecipientAddress: "...",    // Your Fordefi Solana vault address
  evmRecipientAddress: "0x...",     // Destination EVM address
  fordefiVaultId: "...",            // Your Fordefi Solana vault ID
};
```

**Running**:
```bash
npm run solana2evm
```

**Important**: This script uses Fordefi's API signer for both the Solana burn and Arbitrum mint transactions. Make sure your API signer is running and you have the correct vault permissions.

## Running the Examples

```bash
# Install dependencies
npm install

# Configure your settings in src/config.ts

# Bridge EVM to EVM
npm run evm2evm

# Bridge EVM to Solana
npm run evm2solana

# Bridge Solana to EVM
npm run solana2evm
```

## Manual Claim (Recovery)

If the EVM → Solana bridge burn succeeds but the Solana mint fails, use the manual claim script to complete the transfer.

### When to Use

- Bridge shows `state: error` with mint failure
- Burn transaction succeeded on EVM (you have the tx hash)
- Error message like `"AccountNotFound"` or `"Pre-flight simulation failed"`

### Usage

```bash
npm run claim-solana -- --tx-hash <evm-burn-tx-hash>
```

### Example

```bash
# Using the burn transaction hash from Arbitrum
npm run claim-solana -- --tx-hash 0x8b4bfcd37afb11285dceeaeef4ba000d4d5ad3e8bc706987a2fde38b921010a7
```

### What It Does

1. **Fetches the CCTP message** from the EVM burn transaction
2. **Retrieves the attestation** from Circle's API (polls until ready)
3. **Completes the mint** on Solana using the Bridge Kit

### Output

```text
=== CCTP Manual Claim for Solana ===

Fetching burn transaction: 0x8b4bfcd...
Message hash: 0x63853ccd...

Fetching attestation from Circle...
Attestation received (attempt 3)

=== Completing Mint on Solana ===

Recipient: CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim
Submitting receiveMessage transaction...

Mint successful!
TX: https://solscan.io/tx/...
```

### Requirements

- Relayer wallet (`PHANTOM_PK`) must have SOL for transaction fees
- Recipient's USDC token account must exist (created automatically by `evm2solana`)
- Original burn transaction must have succeeded on EVM

## Common Issues

1. **"Account not found"** - For Solana, ensure the Fordefi vault's USDC token account exists
2. **"Invalid attestation"** - Wait longer for attestation or verify the source transaction succeeded
3. **Bridge pending** - Standard transfers take 13-19 minutes; fast transfers take ~20 seconds
4. **Insufficient SOL** - For EVM to Solana, ensure the relayer account (Phantom PK) has enough SOL to pay for transaction fees
5. **"Recipient mismatch"** - For Solana to EVM, verify the `evmRecipientAddress` in config matches the intended recipient
6. **Wrong MessageTransmitter** - Ensure you're using the correct V2 MessageTransmitter address for your destination chain

## Resources

- [Circle CCTP Documentation](https://developers.circle.com/cctp)
- [Circle CCTP V2 EVM Contracts](https://developers.circle.com/cctp/evm-smart-contracts)
- [Bridge Kit Documentation](https://developers.circle.com/bridge-kit)
- [Solana CCTP Programs](https://developers.circle.com/cctp/solana-programs)
- [Circle CCTP GitHub](https://github.com/circlefin/solana-cctp-contracts)
- [Fordefi API Documentation](https://docs.fordefi.com/developers)
