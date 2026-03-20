# NEAR Intents — Fordefi Black Box Signing

Cross-chain token swaps using the [NEAR Intents 1Click API](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart), with Fordefi signing the on-chain deposit transactions.

## How NEAR Intents work

NEAR Intents is a solver-based swap protocol. A **solver** finds the best route for your swap across supported chains (NEAR, Ethereum, Solana, TON, and others). You don't interact with DEXes directly — you deposit tokens to a solver-provided address and receive the destination tokens at your recipient address.

The flow:

```
You                          1Click API                    Solver Network
 │                               │                              │
 ├─ POST /quote ────────────────►│                              │
 │◄── deposit address + estimate─┤                              │
 │                               │                              │
 ├─ transfer tokens to ──────────┼──────────────────────────────►
 │  deposit address (on-chain)   │                              │
 │                               │                              │
 ├─ POST /deposit/submit ───────►│                              │
 │                               ├─ notify solver ─────────────►│
 │                               │                              │
 │  GET /status (poll) ─────────►│◄── solver executes swap ─────┤
 │◄── SUCCESS + dest tx hash ────┤                              │
```

### What this module does

This module handles the **NEAR side** of that flow. Specifically, it:

1. Requests a quote from the 1Click API
2. If the origin asset is **native NEAR**, wraps it to wNEAR first (via `near_deposit` on `wrap.near`)
3. Calls `ft_transfer` on the token contract to send tokens to the 1Click deposit address
4. Submits the deposit transaction hash to 1Click
5. Polls until the swap reaches a terminal status

Steps 2 and 3 each build an unsigned NEAR transaction, send its SHA-256 hash to Fordefi for ED25519 signing, then broadcast the signed transaction to the NEAR network — the same pattern used by the transfer and staking examples in the parent directory.

## Activating the 1Click API

### 1. Register for an API key (recommended)

Go to the **Partner Dashboard**: <https://partners.near-intents.org/>

Register to receive a JWT token. Set it in your `.env`:

```
ONECLICK_API_KEY=your_jwt_token_here
```

Authenticated requests **avoid the 0.2% platform fee**. Without an API key the module still works, but each swap incurs the fee.

### 2. No testnet

The 1Click API operates on **mainnet only**. Use small amounts when testing. Cross-chain swaps can take up to 15 minutes.

### 3. Track swaps

Monitor in-progress and completed swaps on the [NEAR Intents Explorer](https://explorer.near-intents.org).

## Configuration

Add these variables to your `.env` file (see `.env.example` in the project root):

```bash
# Origin asset in 1Click format: chain:network:address
INTENTS_ORIGIN_ASSET=near:mainnet:native

# Destination asset
INTENTS_DESTINATION_ASSET=eth:1:native

# Amount in the smallest unit of the origin asset
# For native NEAR: yoctoNEAR (1 NEAR = 1e24 yoctoNEAR)
INTENTS_AMOUNT=1000000000000000000000000

# Recipient address on the destination chain
INTENTS_RECIPIENT=0xYourEthAddress

# Slippage tolerance in basis points (100 = 1%)
INTENTS_SLIPPAGE=100

# Optional: JWT from the Partner Dashboard
ONECLICK_API_KEY=
```

Plus the standard Fordefi variables (`FORDEFI_API_USER_TOKEN`, `BLACKBOX_VAULT_ID`, `VAULT_PUBLIC_KEY`) and `NEAR_NETWORK=mainnet`.

## Usage

```bash
npm run intents
```

## Asset ID format

The 1Click API identifies assets as `chain:network:address`:

| Asset | ID |
|---|---|
| Native NEAR | `near:mainnet:native` |
| wNEAR | `near:mainnet:wrap.near` |
| USDT on NEAR | `near:mainnet:usdt.tether-token.near` |
| ETH on Ethereum | `eth:1:native` |
| USDC on Ethereum | `eth:1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` |

Call `GET https://1click.chaindefuser.com/v0/tokens` for the full list of supported tokens.

When the origin is `near:mainnet:native`, the module automatically wraps NEAR → wNEAR before depositing. For any other NEAR-based token (e.g. wNEAR, USDT), it calls `ft_transfer` directly.

## Module structure

| File | Purpose |
|---|---|
| `intents-interfaces.ts` | TypeScript types for 1Click API requests, responses, and config |
| `oneclick-api.ts` | HTTP client — `getQuote`, `submitDeposit`, `pollStatus`, `fetchTokens` (5-min cache) |
| `near-wrap-serializer.ts` | Builds unsigned `near_deposit` transaction on `wrap.near` |
| `intents-deposit-serializer.ts` | Builds unsigned `ft_transfer` transaction to the 1Click deposit address |
| `near-intents-run.ts` | Orchestrator entry point that ties everything together |

## References

- [1Click API Quickstart](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart)
- [1Click API Authentication](https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication)
- [NEAR Intents Explorer](https://explorer.near-intents.org)
- [Partner Dashboard (API key registration)](https://partners.near-intents.org/home)
