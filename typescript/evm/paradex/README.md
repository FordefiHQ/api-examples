# Paradex Integration with Fordefi

This script demonstrates how to interact with [Paradex](https://paradex.trade) (a decentralized perpetuals exchange on Starknet) using a Fordefi vault as the signing wallet.

## Overview

The integration uses:
- **Fordefi Web3 Provider** - Signs transactions using your Fordefi EVM vault
- **Paradex SDK** - Derives a Starknet account from your Ethereum signature and interacts with Paradex

### How Account Derivation Works

Paradex uses deterministic key derivation:
1. Your Ethereum wallet signs a specific message
2. The signature is used to derive a Starknet private key
3. Your Paradex address is derived from that Starknet key

This means your Fordefi EVM vault address deterministically maps to a unique Paradex account.

## Setup

### Prerequisites

- Node.js 18+
- A Fordefi EVM vault with funds deposited on Paradex
- Fordefi API credentials
- **Deterministic Signatures enabled** (see below)

### Deterministic Signatures Requirement

Since Fordefi is an MPC wallet, signatures are generated collaboratively across multiple parties. By default, MPC wallets can produce different valid signatures for the same message each time.

**This breaks Paradex account derivation**, which requires the same signature to derive the same Starknet key every time.

To use this script, you must have **Deterministic Signatures** enabled for your Fordefi organization. This ensures that signing the Paradex key derivation message always produces the same signature, mapping to the same Paradex account.

**To enable:** Contact the Fordefi team to activate Deterministic Signatures for your organization.

See: [Fordefi Deterministic Signatures Documentation](https://docs.fordefi.com/user-guide/manage-transactions/deterministic-signatures)

### Installation

```bash
npm install
```

### Configuration

1. Create a `.env` file:

```env
FORDEFI_API_USER_TOKEN=your_api_token
FORDEFI_EVM_VAULT_ADDRESS=0x...
```

2. Place your Fordefi private key PEM file at `./secret/private.pem`

3. Edit `src/config.ts` to set your desired action:

```typescript
export const paradexAction: ParadexAction = {
  action: "balance",        // "balance" or "withdraw"
  amountToWithdraw: "1"     // Amount in USDC (only used for withdraw)
};
```

## Usage

```bash
npm run action
```

### Actions

| Action | Description |
|--------|-------------|
| `balance` | Check your USDC balance on Paradex |
| `withdraw` | Withdraw USDC from Paradex to Ethereum L1 |

## Withdrawal Process

### How Native Withdrawals Work

When you call `withdraw()` with an empty bridge call (`[]`), funds are withdrawn via **StarkGate** (the native Starknet<>Ethereum bridge):

```
Paradex (L2) → StarkGate Bridge → Ethereum (L1)
```

### Withdrawal Timeline

Native StarkGate withdrawals are **slow** due to the ZK proof process:

| Stage | Duration |
|-------|----------|
| L2 Transaction | Immediate |
| Batching | Variable (depends on volume) |
| Proof Generation | ~2 hours |
| L1 Verification | ~30 minutes |
| **Total** | **4-12+ hours** |

You can monitor state updates at [L2BEAT Paradex](https://l2beat.com/scaling/projects/paradex) under "Liveness > State Updates".

### Faster Alternatives

For faster withdrawals, Paradex supports third-party bridges via the `bridgeCall` parameter:

| Bridge | Speed | Fee |
|--------|-------|-----|
| Native StarkGate | 4-12+ hours | Gas only |
| [rhino.fi](https://rhino.fi) | Minutes | ~0.1-0.3% |
| [Layerswap](https://layerswap.io) | Minutes | ~0.1-0.5% |

These liquidity bridges front you funds on L1 immediately.

### Socialized Loss

During certain market conditions, Paradex may apply a socialized loss factor. The script checks for this:

```typescript
const receivable = await paradexClient.getReceivableAmount('USDC', amount);
if (Number(receivable.socializedLossFactor) !== 0) {
  // You will receive less than requested
}
```

## File Structure

```
├── src/
│   ├── run.ts           # Main entry point
│   ├── config.ts        # Fordefi and action configuration
│   ├── get-provider.ts  # Fordefi provider initialization
│   └── withdraw.ts      # Withdrawal logic
├── secret/
│   └── private.pem      # Fordefi API signing key (gitignored)
├── .env                 # Environment variables (gitignored)
└── package.json
```

## References

- [Paradex Documentation](https://docs.paradex.trade)
- [Paradex SDK (npm)](https://www.npmjs.com/package/@paradex/sdk)
- [StarkGate Documentation](https://docs.starknet.io/learn/protocol/starkgate)
- [Fordefi Web3 Provider](https://www.npmjs.com/package/@fordefi/web3-provider)
