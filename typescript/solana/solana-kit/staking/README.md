# Solana Staking with Fordefi + Solana Kit

Stake, unstake, and withdraw SOL using [Fordefi](https://fordefi.com) and the [Solana Kit](https://www.solanakit.com/) library.

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
ORIGIN_VAULT=your_solana_vault_id
ORIGIN_ADDRESS=your_solana_vault_address
VALIDATOR_ADDRESS=validator_vote_account_address
STAKE_ACCOUNT_ADDRESS=your_stake_account_address
```

2. Place your API User private key at `./secret/private.pem`

3. Edit `src/config.ts` to configure the staking parameters:

```typescript
action: "stake" as StakeAction,      // "stake" | "unstake" | "withdraw"
amountToStake: "0.001",              // Amount in SOL to stake - does NOT include rent fees
amountToWithdraw: "0.001",           // Amount in SOL to withdraw
```

## Actions

### Stake

Delegate SOL to a validator. Creates a new stake account and delegates to the specified validator.

**Required env variables:**

- `VALIDATOR_ADDRESS` - The validator's vote account address (find validators at [staking.kiwi](https://staking.kiwi/))

**Configuration:**

```typescript
action: "stake"
amountToStake: "1.0"  // Amount in SOL
```

### Unstake (Deactivate)

Deactivate an existing stake account. After deactivation, you must wait approximately 2 epochs (~4 days) before withdrawing.

**Required env variables:**

- `STAKE_ACCOUNT_ADDRESS` - Your stake account address (find it on [Solscan](https://solscan.io/) under your wallet's stake accounts)

**Configuration:**

```typescript
action: "unstake"
```

### Withdraw

Withdraw SOL from a deactivated stake account back to your vault.

**Required env variables:**

- `STAKE_ACCOUNT_ADDRESS` - Your stake account address (must be fully deactivated)

**Configuration:**

```typescript
action: "withdraw"
amountToWithdraw: "1.0"  // Amount in SOL
```

## Usage

```bash
npm run action
```

## Staking Lifecycle

1. **Stake** - Delegate SOL to a validator and start earning rewards
2. **Unstake** - Deactivate your stake (wait ~2 epochs for cooldown)
3. **Withdraw** - Retrieve your SOL after the cooldown period
