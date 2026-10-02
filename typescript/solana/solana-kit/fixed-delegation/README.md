# Fixed Delegation with Fordefi + Solana Kit

Create, use and revoke a [fixed delegation](https://github.com/solana-program/subscriptions) using [Fordefi](https://fordefi.com) and the [Solana Kit](https://www.solanakit.com/) library.

A fixed delegation lets a delegator approve another wallet to pull up to a fixed token amount from their token account. Each successful transfer reduces the remaining allowance. The delegator signs setup and revoke transactions, the delegatee signs transfers.

Both vaults sign through [`@solana/keychain-fordefi`](https://github.com/solana-foundation/solana-keychain/tree/main/typescript/packages/fordefi), a Kit signer for a Fordefi vault: it signs the API request with your API User key, submits the transaction to Fordefi, waits for the MPC signature and verifies it. The signer runs in Fordefi's auto push mode, so Fordefi broadcasts each transaction.

> **Dependency note:** `@solana/subscriptions` (0.5.0, the latest release) still declares a peer dependency on `@solana/kit` ^7, while the keychain needs kit 8. `package.json` therefore sets `"overrides": { "@solana/kit": "$@solana/kit" }` so the whole tree runs on this project's kit 8. Remove the override once `@solana/subscriptions` supports kit 8.

## Prerequisites

1. **Fordefi API Setup**: Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)

## Installation

```bash
npm install
```

## Configuration

1. Credentials are shared by all solana-kit examples: put your API User private key at `solana-kit/secret/private.pem` and these variables in `solana-kit/.env` (see the [shared setup](../README.md)):

```env
FORDEFI_API_TOKEN=your_api_token
DELEGATOR_VAULT_ID=delegator_solana_vault_id
DELEGATOR_VAULT_ADDRESS=delegator_solana_vault_address
DELEGATEE_VAULT_ID=delegatee_solana_vault_id   # only required for the transfer script
DELEGATEE_VAULT_ADDRESS=delegatee_solana_vault_address
```

2. Edit `src/config.ts` to configure the delegation:

```typescript
export const delegationConfig: DelegationConfig = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Token mint (USDC)
  decimals: 6,
  nonce: 0,               // differentiates multiple delegations to the same delegatee
  allowance: 1_000_000,   // total pullable amount in base units (1 USDC)
  expiryDays: 30,         // 0 = no expiry
  transferAmount: 100_000 // amount pulled per transfer (0.1 USDC)
};
```

The token program is read from the mint, so classic SPL Token and Token-2022 mints both work, as long as the Subscriptions program accepts the mint: it rejects mints with a permanent delegate, transfer fee, transfer hook, mint close authority, confidential transfers, non-transferable or pausable extensions. Mainnet USDG has several of these, so this example uses USDC.

## Usage

### 1. Create the delegation (signed by the delegator's vault)

```bash
npm run create-delegation
```

Initializes the per-(user, mint) Subscription Authority PDA if it doesn't exist yet (as a separate transaction, since the delegation must be created against the authority's live `init_id`), then creates the fixed delegation PDA.

### 2. Transfer from the delegation (signed by the delegatee's vault)

```bash
npm run transfer
```

The delegatee pulls `transferAmount` from the delegator's token account to the receiver (the delegatee's own ATA by default), reducing the remaining allowance. Requires `DELEGATEE_VAULT_ID` to be set.

### 3. Revoke the delegation (signed by the delegator's vault)

```bash
npm run revoke
```

Closes the delegation PDA and returns its rent to the delegator. The delegator can revoke at any time.

## Testing

```bash
npm test
```

The tests run the three scripts against a mock Fordefi API and a mock Solana RPC, both backed by [LiteSVM](https://github.com/LiteSVM/litesvm), with the real Subscriptions program loaded. On the first run, `pretest` caches the deployed program binary in `test/fixtures/` (git-ignored) with one read-only mainnet RPC call; after that the tests need no network. No credentials or funds are needed. They check the requests each vault's signer sends to Fordefi, and that the delegation is created, pulled from (reducing the allowance) and revoked on-chain.
