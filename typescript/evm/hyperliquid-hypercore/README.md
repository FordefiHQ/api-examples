# Hyperliquid HyperCore with Fordefi

A standalone TypeScript example for using a Fordefi EVM vault with Hyperliquid HyperCore. It supports deposits, withdrawals, transfers, perpetual orders, vault operations, and optional agent wallets.

## Prerequisites

- Node.js and npm
- A Fordefi EVM vault, API User token, API User private key, and running API Signer
- Fordefi support for EIP-712 signing with chain ID `1337`

See the [Fordefi developer documentation](https://docs.fordefi.com/developers/program-overview) for API Signer setup.

## Installation

```bash
npm install
cp .env.example .env
```

Fill in the Fordefi credentials and vault details in `.env`, then place the API User private key at `./secret/private.pem`.

Run an action with:

```bash
ACTION=withdraw npm run action
```

`ACTION` is required and must be one of:

```text
deposit | withdraw | sendUsd | vault_transfer | approve_agent | revoke_agent | spotTransfer | subAccountTransfer | placeOrder
```

Missing actions, unknown actions, invalid addresses, malformed amounts, and failed API calls produce a nonzero exit status.

## Network and signing behavior

- Hyperliquid L1 actions use signature chain ID `1337` (`0x539`) on both mainnet and testnet.
- Deposit permit signing uses Arbitrum chain ID `42161` automatically. You do not need to edit `fordefiConfig.chainId` before depositing.
- Deposit is mainnet-only in this example and always broadcasts. On testnet, use the [Hyperliquid testnet faucet](https://app.hyperliquid-testnet.xyz).
- `HYPERLIQUID_TESTNET` defaults to `true`; set it to `false` for mainnet actions.

The `pushMode` setting in `src/config.ts` applies to Hyperliquid L1 EIP-712 actions:

- `auto` returns the signature to the Hyperliquid SDK, which broadcasts the action.
- `manual` stops before SDK broadcast and returns `{ signature, broadcast: false }`.

Deposit ignores manual mode because its permit and Arbitrum bridge transaction must be submitted together.

## Configuration

This example remains config-driven. Common values can be supplied through `.env`; action-specific values can also be edited in `src/config.ts`.

| Action | Required configuration |
|---|---|
| `deposit` | `amount` of at least 5 USDC; mainnet only |
| `withdraw` | `destination`, positive `amount` |
| `sendUsd` | `destination`, positive `amount` |
| `spotTransfer` | positive `amount`, `token` in `TOKEN:0xHEX` format, `toSpot` direction |
| `subAccountTransfer` | `transfer.market`, `from`, `to`, and positive `amount`; spot also requires `token` |
| `vault_transfer` | `hyperliquidVaultAddress`, `isDeposit`, and positive `amount` |
| `placeOrder` | one order in `orderConfig` |
| `approve_agent` | `agentName`; optionally an existing `agentAddress` and `validUntil` |
| `revoke_agent` | `agentName` |

EVM addresses are fully validated. USDC amounts support at most six decimal places and are converted with integer arithmetic.

### Deposit

```bash
HYPERLIQUID_TESTNET=false ACTION=deposit AMOUNT=5 npm run action
```

The action fetches the USDC permit nonce, signs the permit through Fordefi, submits `batchedDepositWithPermit` on Arbitrum, and polls Fordefi until the transaction succeeds or fails.

### Withdraw or send USDC

```bash
ACTION=withdraw DESTINATION_ADDRESS=0x... AMOUNT=1 npm run action
ACTION=sendUsd DESTINATION_ADDRESS=0x... AMOUNT=1 npm run action
```

No destination is supplied by default, which prevents accidental transfers to a sample address.

### Perps and spot transfer

Edit the `token` and `toSpot` fields in `hyperliquidConfig`, then run:

```bash
ACTION=spotTransfer AMOUNT=2 npm run action
```

`toSpot: true` moves Perps to Spot; `false` moves Spot to Perps.
Token identifiers differ between mainnet and testnet, so replace the sample token when targeting testnet.

### Sub-account transfer

Configure `transfer` in `src/config.ts`. Exactly one side must be `"master"`:

```typescript
transfer: {
    market: "perps",
    from: "master",
    to: process.env.SUBACCOUNT_ADDRESS as `0x${string}`,
    amount: "5",
}
```

Then run:

```bash
ACTION=subAccountTransfer SUBACCOUNT_ADDRESS=0x... npm run action
```

For spot transfers, set `market: "spot"` and provide a token identifier. Direct sub-account-to-sub-account transfers are not supported; use two actions through the master account.

### Place a perpetual order

Edit `orderConfig` in `src/config.ts`, then run:

```bash
ACTION=placeOrder npm run action
```

The example supports one order at a time. It loads the selected asset metadata and midpoint, then uses the Hyperliquid SDK's price and size formatters without mutating the configured order.

### Agent wallets

Agent wallets are optional; Fordefi can sign Hyperliquid actions directly.

When `approve_agent` has no configured `agentAddress`, the example creates a key at the configured `privateKeyOutputPath`. The file is created with owner-only permissions and will never overwrite an existing file. Back it up securely before using the agent. If `validUntil` is omitted, no validity suffix is added to the agent name.

```bash
ACTION=approve_agent npm run action
ACTION=revoke_agent npm run action
```

## Verification

All tests are offline and require no credentials, funds, RPC calls, or live API access.

```bash
npm run typecheck
npm test
npm run check
```

`npm run check` is the acceptance command and runs both the TypeScript compiler and the unit tests.
