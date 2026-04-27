# Avalanche P-Chain with Fordefi Blackbox Vault

Concise guide for executing P-Chain transfers and staking operations using Fordefi's blackbox signature vault.

## Overview

These scripts enable the following actions via black-box signing:
- **AVAX transfers** on P-Chain
- **Delegation staking** to validator nodes om P-Chain

## Prerequisites

- Node.js with TypeScript support
- Fordefi Black Box vault with `key_type=ecdsa_secp256k1` [documentation](https://docs.fordefi.com/api/latest/openapi/vaults/create_vault_api_v1_vaults_post)
- Fordefi API User and API Signer running [documentation](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
- AVAX balance on P-Chain
- Your API User private key in a `./secret` folder at the root of this project

## Environment Setup

Create a `.env` file with the following variables:

```bash
# Fordefi API Configuration
FORDEFI_ACCESS_TOKEN=your_api_user_access_token_here
VAULT_ID=your_vault_id_here

# Vault Public Key (33-byte compressed secp256k1, base64-encoded)
VAULT_PUBLIC_KEY=AylGVK5wbcLMJ5xQ32LlXUyXhP73WNzcF/o2ho+/nj8n

# Transfer Configuration
DESTINATION_ADDRESS=P-avax1...  # Recipient address for transfers

# Staking Configuration (if using staking)
NODE_ID=NodeID-...              # Validator to delegate to
REWARD_ADDRESS=P-avax1...       # Optional: where rewards go (defaults to origin)
```

## Configuration Files

Update `src/pchain-config.ts` with your settings:

```typescript
export const fordefiPChainConfig = {
  accessToken: process.env.FORDEFI_ACCESS_TOKEN!,
  originVault: process.env.VAULT_ID!,
  privateKeyPem: process.env.FORDEFI_PRIVATE_KEY_PEM!,
  apiPathEndpoint: '/api/v1/transactions',
  
  // Transfer amount in AVAX
  transferAmount: 0.1,
  
  // Staking configuration
  stakeAmount: BigInt(25) * BigInt(1e9), // 25 AVAX in nAVAX
  startTime: BigInt(Math.floor(Date.now() / 1000) + 60),
  endTime: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14), // 14 days
  nodeId: process.env.NODE_ID || "",
  rewardAddress: process.env.REWARD_ADDRESS,
};
```

## Usage

### 1. Derive Your P-Chain Address

Before transacting, derive your P-Chain address from your vault's public key:

```bash
npx ts-node src/derive_avalanche_p_chain_address.ts
```

Or use the utility programmatically:

```typescript
import { publicKeyToPChainAddressCompat } from './pchain-address-utils';

const publicKeyBuffer = Buffer.from(process.env.VAULT_PUBLIC_KEY!, 'base64');
const address = await publicKeyToPChainAddressCompat(publicKeyBuffer);
console.log('Your P-Chain address:', address);
```

### 2. Execute P-Chain Transfer

Transfer AVAX from your vault to another P-Chain address:

```bash
npx ts-node src/pchain-transfer-run.ts
```

**What happens:**
1. Derives origin P-Chain address from vault public key
2. Builds unsigned P-Chain base transaction (using UTXOs)
3. Computes SHA256 hash of transaction bytes
4. Sends hash to Fordefi for blackbox signing
5. Polls Fordefi until signature is ready
6. Attaches signature to transaction
7. Broadcasts signed transaction to P-Chain
8. Returns transaction ID and status

### 3. Execute P-Chain Staking

Delegate AVAX to a validator node:

```bash
npx ts-node src/pchain-staking-run.ts
```

**What happens:**
1. Derives origin P-Chain address from vault public key
2. Builds unsigned `AddPermissionlessDelegatorTx` transaction
3. Computes SHA256 hash of transaction bytes
4. Sends hash to Fordefi for blackbox signing
5. Polls Fordefi until signature is ready
6. Attaches signature to transaction
7. Broadcasts signed transaction to P-Chain
8. Returns delegation transaction ID

## Architecture

### Transaction Flow

```
┌─────────────────┐
│  Build Unsigned │  ← pchain-transfer-serializer.ts
│   Transaction   │    pchain-staking-serializer.ts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Compute SHA256 │
│   Transaction   │
│      Hash       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sign Request   │  ← signer.ts (API authentication)
│   to Fordefi    │    process_tx.ts (API calls)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Fordefi API   │
│  Blackbox Sign  │  (vault signs hash internally)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Poll & Fetch   │  ← broadcast-pchain-transaction.ts
│    Signature    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Attach Sig &   │
│  Broadcast to   │
│     P-Chain     │
└─────────────────┘
```

### Key Components

| File | Purpose |
|------|---------|
| `signer.ts` | Signs Fordefi API requests with your API private key |
| `process_tx.ts` | Creates and fetches transactions from Fordefi API |
| `pchain-address-utils.ts` | Derives P-Chain addresses from secp256k1 public keys |
| `pchain-transfer-serializer.ts` | Builds unsigned transfer transactions |
| `pchain-staking-serializer.ts` | Builds unsigned staking delegation transactions |
| `broadcast-pchain-transaction.ts` | Fetches signatures and broadcasts to P-Chain |
| `pchain-transfer-run.ts` | Main entry point for transfers |
| `pchain-staking-run.ts` | Main entry point for staking |

## Fordefi Payload Format

Both transfer and staking use the same payload structure:

```typescript
{
  vault_id: "your_vault_id",
  signer_type: "api_signer",
  sign_mode: "auto",
  type: "black_box_signature",
  details: {
    format: "hash_binary",
    hash_binary: "<base64_encoded_sha256_hash>"
  }
}
```

The `hash_binary` is the **SHA256 hash** of the unsigned transaction bytes.

## Important Notes

### Address Format
- Avalanche P-Chain addresses use format: `P-avax1...`
- Addresses are derived via: `SHA256(pubkey) → RIPEMD160 → Bech32("avax")`
- The P-Chain prefix is uppercase: `P-` not `p-`

### Amounts
- All amounts are in **nAVAX** (nano-AVAX)
- 1 AVAX = 1,000,000,000 nAVAX (1e9)
- Example: `BigInt(25) * BigInt(1e9)` = 25 AVAX

### Staking Requirements
- Minimum delegation: 25 AVAX
- Minimum duration: 14 days
- Start time must be in the future (at least 60 seconds)
- Node ID format: `NodeID-...` (get from validator)

### Signature Format
- Fordefi returns 65-byte signatures: `[r (32) | s (32) | v (1)]`
- Recovery ID (v) is the 65th byte
- Signatures are returned as base64, converted to bytes for Avalanche

