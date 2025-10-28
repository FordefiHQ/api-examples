# CCTP Circle Bridge with Fordefi

Bridge USDC across chains using Circle's CCTP (Cross-Chain Transfer Protocol) with Fordefi.

## Overview

This repository contains two examples:

1. **EVM to EVM** - Bridge USDC between EVM chains (e.g., Arbitrum → Base)
2. **EVM to Solana** - Bridge USDC from EVM chains to Solana

Both examples use **Circle Bridge Kit**, which automatically handles:
- USDC burning on source chain
- Attestation polling from Circle's Iris API
- USDC minting on destination chain

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

3. **Configuration** (`src/config.ts`):
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

## Running the Examples

```bash
# Install dependencies
npm install

# Configure your settings in src/config.ts

# Bridge EVM to EVM
npm run evm2evm

# Bridge EVM to Solana
npm run evm2solana
```

## Common Issues

1. **"Account not found"** - For Solana, ensure the Fordefi vault's USDC token account exists
2. **"Invalid attestation"** - Wait longer for attestation or verify the source transaction succeeded
3. **Bridge pending** - Standard transfers take 13-19 minutes; fast transfers take ~20 seconds
4. **Insufficient SOL** - Ensure the relayer account (Phantom PK) has enough SOL to pay for transaction fees to mint USDC on Solana

## Resources

- [Circle CCTP Documentation](https://developers.circle.com/cctp)
- [Bridge Kit Documentation](https://developers.circle.com/bridge-kit)
- [Solana CCTP Programs](https://developers.circle.com/cctp/solana-programs)
- [Circle CCTP GitHub](https://github.com/circlefin/solana-cctp-contracts)
