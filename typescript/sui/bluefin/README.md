# Bluefin Programmatic Trading with Fordefi

A tool for swapping and creating pools on Bluefin on Sui with your Fordefi Vault.

## Prerequisites

- Fordefi API user token and API Signer set up ([link to tutorial](https://docs.fordefi.com/developers/program-overview))
- Sui Vault in Fordefi

## Setup

1. Create a Fordefi API user and API Signer ([tutorial](https://docs.fordefi.com/developers/program-overview))
2. Register your API User's key with your API Signer ([tutorial](https://docs.fordefi.com/developers/getting-started/pair-an-api-client-with-the-api-signer))
3. Clone this repository.
4. Run `npm install` to install all the dependencies.
5. Create a `.env` file in the root directory with the following variable:
   ```typescript
   FORDEFI_API_TOKEN="<your_api_user_token>" // Your Fordefi API User JWT
   VAULT_ID="<your_fordefi_sui_vault_id>"
   VAULT_ADDRESS="<your_fordefi_sui_vault_address>"
   ```
6. Create a `/fordefi_secret` folder at the root of the `bluefin` project and place your API User's `private.pem` private key file in the folder.

## Example usage for a swap on Bluefin

1. Ensure your API Signer is running.
2. In `swap.ts`, configure the `swapParams`, for example:
```typescript
  const swapParams = {
    poolId: config.Pools[4].id,    // Bluefin Pool ID for SUI/USDC
    amount: 1_000_000,             // Amount to swap in MIST (1 SUI = 1_000_000_000 MIST)
    aToB: true,                    // Direction: true = SUI to USDC
    byAmountIn: true,              // byAmountIn: true = amount specified is the input amount
    slippageProtection: 1_000,     // Minimum amount to receive in the target token (slippage protection)
    maximumSqrt: "<your_value>"              // Maximum allowed sqrt price after the swap (price impact protection) - For aToB swaps, this should be **lower** than current sqrt price
  };
```
3. Run `npm run swap`. The script will create and sign a swap transaction with your Fordefi Vault and send the transaction to Bluefin for execution.

## Example usage for creating a pool on Bluefin

1. Ensure your API Signer is running.
2. In `pool.ts`, configure the `liquidityParams`, for example:
```typescript
  const liquidityParams = {
    fix_amount_a: true, // We cap the maximum amount of token A (here SUI) to provide to the pool 
    coinAmount: "1000", // Amount of the fixed token (SUI)
    tokenMaxA: "1000",  // Max amount of token A (SUI) to use (if fix_amount_a is false) -> expressed in MIST
    tokenMaxB: "1000",  // Max amount of token B (USDC) to use (if fix_amount_a is true) -> expressed in USDC
    lowerTick: -100000,
    upperTick: 100000
  };
```
3. Run `npm run pool`. The script will create and sign a swap transaction with your Fordefi Vault and send the transaction to Bluefin for execution.


