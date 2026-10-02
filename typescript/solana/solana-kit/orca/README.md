# Orca DeFi Operations with Fordefi

This helper code allows you to programmatically interact with Orca DEX on Solana through your Fordefi Solana Vault. It supports swapping tokens, opening positions, managing liquidity, and harvesting pool rewards.

## Features

- **Swap tokens** on Orca pools
- **Open liquidity positions** in Orca concentrated liquidity pools
- **Harvest rewards** from existing positions
- **Remove liquidity** from positions
- **Increase liquidity** from positions
- **Close positions** completely
- **Transaction broadcasting** options:
  - Standard Fordefi broadcasting
  - Jito broadcasting

## Prerequisites

- Fordefi organization and Solana vault
- Node.js and npm installed
- Fordefi credentials: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))
- TypeScript setup:
  ```bash
  # Install TypeScript and type definitions
  npm install typescript --save-dev
  npm install @types/node --save-dev
  npm install tsx --save-dev
  
  # Initialize a TypeScript configuration file (if not already done)
  npx tsc --init
  ```

## Setup

1. Clone this repository
2. Install dependencies
   ```bash
   npm install
   ```

3. Add the following variables to `solana-kit/.env`, shared by all solana-kit examples (see the [shared setup](../README.md)):
   ```
   FORDEFI_API_TOKEN=your_fordefi_api_user_token
   FORDEFI_VAULT_ID=your_fordefi_vault_id
   FORDEFI_VAULT_ADDRESS=your_fordefi_solana_wallet_address
   ORCA_POSITION_MINT_ADDRESS=your_position_mint_address_if_applicable
   ```

4. Place your API User's private key at `solana-kit/secret/private.pem`:
   ```bash
   mkdir -p ../secret
   cp /path/to/your/private.pem ../secret/private.pem
   ```

## Usage

First ensure that your API Signer is running:

```bash
docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
```

### Token Swaps

Edit the `swapConfig` in `orca_swap.ts` to specify:
- `orcaPool`: Address of the Orca pool to use
- `mintAddress`: Token mint address you want to swap from
- `swapAmount`: Amount to swap (in smallest denomination, e.g., lamports)
- `useJito`: Whether to use Jito's Block Engine to broadcast the transaction
- `jitoTip`: If using Jito, tip amount for Jito (in lamports)

Then run:
```bash
npm run swap
```

### Opening a New Position

Edit the `openPositionConfig` in `orca_open_position.ts` to specify:
- `orcaPool`: Address of the Orca pool to use
- `tokenAAmount`: Amount of token A to provide (in smallest denomination)
- `useJito`: Whether to use Jito's Block Engine to broadcast the transaction
- `jitoTip`: If using Jito, tip amount for Jito (in lamports)

Then run:
```bash
npm run open-position
```

### Harvesting Rewards

Set your position's mint address in `solana-kit/.env` or directly in `harvestPositionConfig` in `orca_harvest_position.ts`:

Then run:
```bash
npm run harvest-position
```

### Removing Liquidity

Edit the `removeLiquidityConfig` in `orca_remove_liquidity.ts` to specify:
- `positionMint`: NFT mint address of your position
- `tokenAAmount`: Amount of token A to withdraw from the pool
- `useJito`: Whether to use Jito's Block Engine to broadcast the transaction
- `jitoTip`: If using Jito, tip amount for Jito (in lamports)

Then run:
```bash
npm run remove-liquidity
```

### Adding Liquidity

Edit the `increaseLiquidityConfig` in `orca_increase_liquidity.ts` to specify:
- `positionMint`: NFT mint address of your position
- `tokenAAmount`: Amount of token A to add to the pool
- `useJito`: Whether to use Jito's Block Engine to broadcast the transaction
- `jitoTip`: If using Jito, tip amount for Jito (in lamports)

Then run:
```bash
npm run increase-liquidity
```

### Closing a Position

Set your position's mint address in `solana-kit/.env` or directly in `closePositionConfig` in `orca_close_position.ts`:

Then run:
```bash
npm run increase-liquidity
```

## Configuration Details

### Fordefi Configuration

The `fordefiConfig` object contains all necessary configurations for interacting with Fordefi:

```typescript
export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.FORDEFI_VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'), // solana-kit/secret/private.pem
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};
```

### Jito Block Engine

For any operation, you can enable Jito by setting `useJito: true` in the relevant configuration object. This will broadcast your transaction through Jito's block engine rather than standard Fordefi channels. You can learn more about Jito [here](https://docs.jito.wtf/lowlatencytxnsend/).

## Transaction Flow

1. The tool creates a transaction specific to your requested operation
2. The transaction is signed with your API private key
3. The signed transaction is sent to Fordefi for MPC signing
4. The fully signed transaction is broadcasted either:
   - Through Fordefi's standard broadcasting (default)
   - Through Jito's block engine (if `useJito: true`)

## Security Notes

- Never share your private key or `.env` file
- Keep your FORDEFI_API_TOKEN secure
- `solana-kit/secret/` and `solana-kit/.env` are included in `.gitignore` to prevent accidental commits