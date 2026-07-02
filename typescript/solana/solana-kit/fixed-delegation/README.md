# Fixed Delegation with Fordefi + Solana Kit

Create, use and revoke a [fixed delegation](https://github.com/solana-program/subscriptions) using [Fordefi](https://fordefi.com) and the [Solana Kit](https://www.solanakit.com/) library.

A fixed delegation lets a delegator approve another wallet to pull up to a fixed token amount from their token account. Each successful transfer reduces the remaining allowance. The delegator signs setup and revoke transactions, the delegatee signs transfers.

## Prerequisites

1. **Fordefi API Setup**: Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)

## Installation

```bash
npm install
```

## Configuration

1. Create a `.env` file:

```env
FORDEFI_API_TOKEN=your_api_token
DELEGATOR_VAULT=delegator_solana_vault_id
DELEGATOR_ADDRESS=delegator_solana_vault_address
DELEGATEE_VAULT=delegatee_solana_vault_id   # only required for the transfer script
DELEGATEE_ADDRESS=delegatee_address
```

2. Place your API User private key at `./secret/private.pem`

3. Edit `src/config.ts` to configure the delegation:

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

The delegatee pulls `transferAmount` from the delegator's token account to the receiver (the delegatee's own ATA by default), reducing the remaining allowance. Requires `DELEGATEE_VAULT` to be set.

### 3. Revoke the delegation (signed by the delegator's vault)

```bash
npm run revoke
```

Closes the delegation PDA and returns its rent to the delegator. The delegator can revoke at any time.
