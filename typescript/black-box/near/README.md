# NEAR Black Box Signing with Fordefi

This project demonstrates how to derive NEAR addresses, transfer NEAR tokens, and stake NEAR using Fordefi's black box signing.

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

## Configuration Options

Edit [near-config.ts](src/near-config.ts) to adjust:

| Option | Description |
|--------|-------------|
| `transferAmount` | Amount in NEAR to transfer (default: 0.001) |
| `stakeAmount` | Amount in NEAR to stake (default: 0.001) |
| `stakingPoolId` | Validator pool ID (e.g., `figment.poolv1.near`) |
