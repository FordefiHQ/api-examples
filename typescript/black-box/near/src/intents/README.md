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

This module deposits tokens **via NEAR** to execute cross-chain swaps. All deposits happen as NEAR on-chain transactions (`ft_transfer`), regardless of the destination chain. This means:

- **Any token with a NEP-141 representation on NEAR** can be used as the origin — including bridged assets like ETH (`eth.omft.near`), USDC, SOL, etc.
- The destination can be **any supported chain** (Ethereum, Solana, TON, etc.) — the solver handles the cross-chain delivery.
- You do **not** need connectivity to the origin or destination chain. Everything goes through NEAR.

> **Important**: This module does NOT deposit on the origin chain directly (e.g. it won't send ETH on Ethereum). It sends the NEP-141 wrapped version of the token on NEAR. Your NEAR account must hold the bridged token balance. If you need to deposit on the origin chain itself (e.g. send native ETH from an Ethereum wallet), you'd need a separate EVM/Solana signing flow.

The steps:

1. Looks up token decimals from `assets.json` (a cached copy of the `/v0/tokens` response)
2. Converts the human-readable amount to smallest unit using the token's decimals
3. Requests a quote from the 1Click API
4. If the origin asset is **native NEAR** (`nep141:wrap.near`), wraps it to wNEAR first (via `near_deposit` on `wrap.near`)
5. Registers the deposit address on the token contract if needed (`storage_deposit`)
6. Calls `ft_transfer` on the token contract to send the NEP-141 tokens to the 1Click deposit address
7. Submits the deposit transaction hash to 1Click
8. Polls until the swap reaches a terminal status

Steps 4–6 each build an unsigned NEAR transaction, send its SHA-256 hash to Fordefi for ED25519 signing, then broadcast the signed transaction to the NEAR network — the same pattern used by the transfer and staking examples in the parent directory.

## Activating the 1Click API

### 1. Register for an API key (recommended)

Go to the **Partner Dashboard**: <https://partners.near-intents.org/>

Register to receive a JWT token. Set it in your `.env`:

```
ONECLICK_API_KEY=your_jwt_token_here
```

Authenticated requests **avoid the 0.1% platform fee**. Without an API key the module still works, but each swap incurs the fee. Auth header: `Authorization: Bearer <key>`.

### 2. No testnet

The 1Click API operates on **mainnet only**. Use small amounts when testing. Cross-chain swaps can take up to 15 minutes.

### 3. Track swaps

Monitor in-progress and completed swaps on the [NEAR Intents Explorer](https://explorer.near-intents.org).

## Configuration

Edit [`swap-config.json`](swap-config.json) to define your swap:

```json
{
  "originAsset": "nep141:eth.omft.near",
  "destinationAsset": "nep141:sol.omft.near",
  "amount": "1.0",
  "recipient": "CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim",
  "refundTo": "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  "slippageBps": 100
}
```

| Field | Description |
|-------|-------------|
| `originAsset` | 1Click `assetId` from `assets.json` (e.g. `"nep141:eth.omft.near"` for bridged ETH on NEAR) |
| `destinationAsset` | 1Click `assetId` for the output token |
| `amount` | Human-readable amount (e.g. `"1.0"` = 1 ETH, `"100"` = 100 USDC). Converted to smallest unit automatically using the token's `decimals` from `assets.json` |
| `recipient` | Destination address on the target chain (EVM address, Solana pubkey, etc.) |
| `refundTo` | Address for refunds if the swap fails. Must be valid for the origin chain. Defaults to the NEAR address if omitted (only correct for NEAR-native origin assets) |
| `slippageBps` | Slippage tolerance in basis points (100 = 1%) |

You also need the standard Fordefi variables in `.env` (`FORDEFI_API_USER_TOKEN`, `BLACKBOX_VAULT_ID`, `VAULT_PUBLIC_KEY`) and `NEAR_NETWORK=mainnet`.

### Token list (`assets.json`)

The module looks up token decimals and symbols from [`assets.json`](assets.json), which is a cached copy of the 1Click `/v0/tokens` response. To refresh it:

```bash
curl -s https://1click.chaindefuser.com/v0/tokens > src/intents/assets.json
```

Browse available tokens:

```bash
cat src/intents/assets.json | jq '.[] | {assetId, symbol, blockchain, decimals}'
```

Common asset IDs:

| Asset | `assetId` |
|-------|-----------|
| wNEAR | `nep141:wrap.near` |
| ETH (Ethereum) | `nep141:eth.omft.near` |
| USDC (Ethereum) | `nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near` |
| SOL (Solana) | `nep141:sol.omft.near` |
| USDT (NEAR) | `nep141:usdt.tether-token.near` |

> **Native NEAR**: Use `nep141:wrap.near` as the `originAsset`. The module detects this and automatically wraps NEAR → wNEAR before depositing.

## Usage

```bash
npm run intents
```

## Module structure

| File | Purpose |
|---|---|
| `swap-config.json` | Swap parameters — origin/destination asset IDs, amount, recipient, slippage |
| `assets.json` | Cached token list from `GET /v0/tokens` — provides decimals, symbols, blockchain info |
| `intents-interfaces.ts` | TypeScript types for 1Click API requests, responses, and config |
| `oneclick-api.ts` | HTTP client — `getQuote`, `submitDeposit`, `pollStatus`, `fetchTokens` |
| `near-wrap-serializer.ts` | Builds unsigned `near_deposit` transaction on `wrap.near` |
| `intents-deposit-serializer.ts` | Builds unsigned `ft_transfer` transaction (with `storage_deposit` if needed) |
| `near-intents-run.ts` | Orchestrator — loads config, resolves assets, quotes, wraps, deposits, polls |

## References

- [1Click API Quickstart](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart)
- [1Click API Authentication](https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication)
- [NEAR Intents Explorer](https://explorer.near-intents.org)
- [Partner Dashboard (API key registration)](https://partners.near-intents.org/home)
