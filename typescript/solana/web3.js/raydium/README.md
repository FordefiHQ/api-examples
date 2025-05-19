# Raydium DeFi Operations with Fordefi

This helper code allows you to programmatically interact with Raydium DEX on Solana through your Fordefi Solana Vault. It supports swapping tokens, opening positions, managing liquidity and harvesting pool rewards.


## Features

- **Token Swaps**: Execute token swaps on Raydium pools
- **Liquidity Management**: Add and remove liquidity from Raydium pools
- **Position Operations**: Open, harvest, and manage concentrated liquidity positions
- **Optional Jito MEV Protection**: Support for optional Jito block engine broadcasting

## Prerequisites

- Node.js (v14+)
- Fordefi vault account and API credentials
- Private key for API request signing
- Solana SPL tokens and SOL in your Fordefi Solana Vault

## Setup

1. Clone this repository
2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   FORDEFI_API_TOKEN=your_fordefi_api_user_token
   VAULT_ID=your_fordefi_vault_id
   VAULT_ADDRESS=your_fordefi_solana_wallet_address
   ```

4. Create a `secret` directory and place your API User's private key file inside:
   ```bash
   mkdir -p secret
   # Add your private.pem file to the secret directory
   ```

## Usage

First ensure that your API Signer is running:

```bash
docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
```

### Token Swaps

Configure and execute token swaps between any two tokens on Raydium:

```bash
# Edit swapConfig parameters in raydium_swap.ts, then:
npm run swap
```

### Open Position

Create concentrated liquidity positions on Raydium pools:

```bash
# Edit openPositionConfig parameters in raydium_open_position.ts, then:
npm run open-position
```

### Harvest Position

Collect fees and rewards from your open concentrated liquidity positions:

```bash
# Edit harvestPositionConfig parameters in raydium_harvest_position.ts, then:
npm run harvest
```

### Remove Liquidity

Remove liquidity from Raydium pools (partial or complete withdrawals):

```bash
# Edit removeLiquidityConfig parameters in raydium_remove_liquidity.ts, then:
npm run remove-liquidity
```

## Configuration

Each operation module has its specific configuration interface. Here are some common parameters:

### Fordefi Configuration

```typescript
export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};
```

### Swap Configuration

```typescript
export const swapConfig: RaydiumSwapConfig = {
  raydiumPool: "FdjBRWXzieV1Qtn8FLDWWk2HK1HSQWYduo8y4F1e8GWu", // Pool address
  inputMint: "So11111111111111111111111111111111111111112", // SOL mint address
  isInputSol: true,
  outputMint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", // Output token mint
  isOutputSol: false,
  swapAmount: 10_000n, // Amount in smallest units (e.g., lamports for SOL)
  slippage: 1, // Slippage tolerance in percentage
  txVersion: 'V0',
  useJito: false, // Use Jito to broadcast transactions
  jitoTip: 1000, // Jito tip in lamports if useJito=true
};
```

### Open Position Configuration

```typescript
export const openPositionConfig: RaydiumOpenPositionConfig = {
  raydiumPool: "8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj", // SOL/USDC pool
  inputAmount: 0.001,   // Amount to provide (in SOL)
  startPrice: 151.74,   // Lower price bound (USDC per SOL)
  endPrice: 151.80,     // Upper price bound (USDC per SOL)
  txVersion: "V0",
  cuLimit: 700_000,
  useJito: false,
  jitoTip: 1000,
};
```

## Transaction Flow

1. The application creates a transaction for the specified operation
2. The transaction is signed with your private key for API authentication
3. The signed transaction is sent to Fordefi for MPC custody signing
4. The fully signed transaction is broadcasted either:
   - Through Fordefi's standard broadcasting (default)
   - Through Jito's block engine (if `useJito: true`)

## Advanced Options

### Using Jito for MEV Protection

Set `useJito: true` in your operation's configuration to have the transaction forwarded to Jito block engine after Fordefi signing.

### Compute Unit Limits

For complex operations, you can adjust the `cuLimit` parameter to allocate more compute units for your transaction.

## Security Considerations

- Keep your `.env` file and private key secure
- Set appropriate slippage tolerance for swap operations
- Keep your FORDEFI_API_TOKEN secure
- The `secret` directory and `.env` are included in `.gitignore` to prevent accidental commits

## Troubleshooting

If you encounter issues:

1. Ensure your Fordefi Solana Vault has sufficient SOL for transaction fees
2. Verify that you have the SPL tokens needed for the operation
3. Verify that your API Signer is running.