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
LAYERSWAP_API_KEY=your_layerswap_api_key
```

2. Place your Fordefi private key PEM file at `./secret/private.pem`

3. Edit `src/config.ts` to set your desired action:

```typescript
// Order configuration (used when action is "place-order")
export const orderDetails: OrderDetails = {
  market: "ETH-USD-PERP",
  side: "BUY",
  type: "LIMIT",
  size: "0.01",
  price: "3000"
};

export const paradexAction: ParadexAction = {
  action: "place-order",  // "balance" | "withdraw-layerswap" | "place-order" | "account-status" | "cancel-orders"
  amountToWithdraw: "1",  // Amount in USDC (for withdrawals)
  // Layerswap options (for withdraw-layerswap)
  layerswapApiKey: LAYERSWAP_API_KEY,
  destinationAddress: FORDEFI_EVM_VAULT_ADDRESS,
  destinationNetwork: "ETHEREUM_MAINNET",
  // Trading options (for place-order)
  orderDetails: orderDetails
};
```

### Getting a Layerswap API Key

To use the fast `withdraw-layerswap` action, you need a Layerswap API key:

1. Register at the [Layerswap Dashboard](https://www.layerswap.io/dashboard)
2. Create an organization
3. Create an app within that organization
4. Copy your API key from the app settings

The dashboard provides both **Mainnet** and **Testnet** keys. Use the appropriate one for your environment.

See: [Layerswap API Keys Documentation](https://docs.layerswap.io/api-keys)

## Usage

```bash
npm run action
```

### Actions

| Action               | Description                                    |
|----------------------|------------------------------------------------|
| `balance`            | Check your USDC balance on Paradex             |
| `withdraw-layerswap` | Withdraw USDC via Layerswap (fast, minutes)    |
| `place-order`        | Place a limit or market order                  |
| `account-status`     | View account info and open orders              |
| `cancel-orders`      | Cancel all open orders (optionally by market)  |

## Withdrawal Process

### Why Layerswap?

Native StarkGate withdrawals are **slow** (4-12+ hours) due to the ZK proof process. This script uses [Layerswap](https://layerswap.io) for fast withdrawals (minutes) with a small fee (~0.1-0.5%).

| Method           | Speed        | Fee         |
|------------------|--------------|-------------|
| Native StarkGate | 4-12+ hours  | Gas only    |
| Layerswap        | Minutes      | ~0.1-0.5%   |

### Layerswap Withdrawal Flow

When using `withdraw-layerswap`, the script:

1. **Creates a swap** via Layerswap API (reserves the swap, gets a deposit address)
2. **Executes Paradex withdrawal** with bridge calls:
   - Transfers USDC to Layerswap's deposit address
   - Calls Layerswap contract to initiate the bridge
3. **Layerswap monitors** and sends funds to your L1 Ethereum address within minutes

```
Paradex (L2) → Layerswap Contract → Layerswap Liquidity → Ethereum (L1)
```

**Limit**: Withdrawals through Layerswap are limited to 60,000 USDC per transaction.

### Socialized Loss

During certain market conditions, Paradex may apply a socialized loss factor. The script checks for this:

```typescript
const receivable = await paradexClient.getReceivableAmount('USDC', amount);
if (Number(receivable.socializedLossFactor) !== 0) {
  // You will receive less than requested
}
```

## Trading

### Order Configuration

Orders are configured via the `orderDetails` object in `src/config.ts`:

```typescript
export const orderDetails: OrderDetails = {
  market: "ETH-USD-PERP",    // Trading pair
  side: "BUY",               // "BUY" or "SELL"
  type: "LIMIT",             // "LIMIT" or "MARKET"
  size: "0.01",              // Position size
  price: "3000"              // Required for LIMIT orders
};
```

### Trading Flow

When placing an order, the script:

1. **Derives Starknet credentials** from your Fordefi Ethereum signature
2. **Onboards** your account to Paradex (only needed once)
3. **Authenticates** to get a JWT token for the REST API
4. **Signs and submits** the order using Starknet typed data signatures

### Available Markets

Common perpetual markets on Paradex:

- `ETH-USD-PERP`
- `BTC-USD-PERP`
- `SOL-USD-PERP`

Check the [Paradex Markets API](https://docs.paradex.trade/api-reference/markets/list-all-markets) for the full list.

## File Structure

```
├── src/
│   ├── run.ts                 # Main entry point
│   ├── config.ts              # Fordefi and action configuration
│   ├── interfaces.ts          # TypeScript interfaces
│   ├── get-provider.ts        # Fordefi provider initialization
│   ├── withdraw-layerswap.ts  # Layerswap withdrawal
│   ├── trading.ts             # Trading functions (place order, cancel, status)
│   └── utils/
│       ├── api.ts             # Paradex REST API functions
│       ├── signature.ts       # Starknet typed data signing
│       ├── typed_data.ts      # Typed data builders for orders
│       ├── conversions.ts     # Amount/price conversions
│       └── types.ts           # Account and config types
├── secret/
│   └── private.pem            # Fordefi API signing key (gitignored)
├── .env                       # Environment variables (gitignored)
└── package.json
```

## References

- [Paradex Documentation](https://docs.paradex.trade)
- [Paradex SDK (npm)](https://www.npmjs.com/package/@paradex/sdk)
- [Layerswap API Documentation](https://docs.layerswap.io/api)
- [Fordefi Web3 Provider](https://www.npmjs.com/package/@fordefi/web3-provider)
- [Fordefi Deterministic Signatures](https://docs.fordefi.com/user-guide/manage-transactions/deterministic-signatures)
