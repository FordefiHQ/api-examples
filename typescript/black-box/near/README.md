# NEAR Black Box Signing with Fordefi

This project demonstrates how to derive NEAR addresses, transfer NEAR tokens, stake NEAR, and perform cross-chain swaps using Fordefi's black box signing.

## Prerequisites

1. **Fordefi API Setup**: Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
2. **Create a Black Box Vault**: Create an ED25519 Black Box vault via the [Vaults API](https://docs.fordefi.com/api/latest/openapi/vaults/create_vault_api_v1_vaults_post):
   ```bash
   curl -X POST https://api.fordefi.com/api/v1/vaults \
     -H "Authorization: Bearer $FORDEFI_API_USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my-near-vault",
       "type": "black_box",
       "key_type": "eddsa_ed25519"
     }'
   ```
   The response includes `public_key_compressed` - use this as `VAULT_PUBLIC_KEY` to derive your NEAR address.
3. **Node.js**: Version 18+

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
# Fordefi Configuration
FORDEFI_API_USER_TOKEN=your_api_token
BLACKBOX_VAULT_ID=your_vault_id
VAULT_PUBLIC_KEY=your_vault_public_key_base64

# NEAR Configuration
NEAR_NETWORK=mainnet  # or testnet
DESTINATION_ADDRESS=recipient.near
STAKING_POOL_ID=figment.poolv1.near

# For Intents (optional)
ONECLICK_API_KEY=     # JWT from https://partners.near-intents.org — avoids 0.1% fee
```

Place your API signer private key at `./secret/private.pem`.

## Usage

### 1. Derive NEAR Address

Derive your NEAR implicit account address from the vault's public key:

```bash
npm run address
```

This outputs your 64-character hex implicit account address. Fund this address before making transactions.

### 2. Transfer NEAR

Transfer NEAR to another account:

```bash
npm run transfer
```

Configure the transfer amount in [near-config.ts](src/near-config.ts) via `transferAmount`.

### 3. Stake NEAR

Stake NEAR with a validator pool:

```bash
npm run stake
```

Configure the stake amount in [near-config.ts](src/near-config.ts) via `stakeAmount` and set `STAKING_POOL_ID` in your `.env`.

### 4. Cross-Chain Swap (Intents)

Swap tokens across chains (NEAR, Ethereum, Solana, TON, and others) via the [NEAR Intents 1Click API](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart):

```bash
npm run intents
```

Configure the swap in [`src/intents/swap-config.json`](src/intents/swap-config.json). See the [intents README](src/intents/README.md) for details.

## Configuration Options

Edit [near-config.ts](src/near-config.ts) to adjust:

| Option | Description |
|--------|-------------|
| `transferAmount` | Amount in NEAR to transfer (default: 0.001) |
| `stakeAmount` | Amount in NEAR to stake (default: 0.001) |
| `stakingPoolId` | Validator pool ID (e.g., `figment.poolv1.near`) |

Edit [swap-config.json](src/intents/swap-config.json) for intents:

| Field | Description |
|-------|-------------|
| `swap.originAsset` | Token key from the `tokens` map (e.g., `near:mainnet:native`) |
| `swap.destinationAsset` | Token key from the `tokens` map (e.g., `eth:1:native`) |
| `swap.amount` | Human-readable amount (e.g., `"1.0"` for 1 NEAR) |
| `swap.recipient` | Destination address on target chain |
| `swap.slippageBps` | Slippage tolerance in basis points (100 = 1%) |
