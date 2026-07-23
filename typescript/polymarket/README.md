# Polymarket × Fordefi

Place bets on [Polymarket](https://polymarket.com) with a Fordefi EVM vault, using Polymarket's **deposit wallet** flow: all onchain operations run gaslessly through Polymarket's [Relayer API](https://docs.polymarket.com/api-reference/relayer/submit-a-transaction), and every order costs the vault exactly one EIP-712 message signature — the vault never broadcasts a transaction.

```text
one-time setup (npm run setup)
  Fordefi vault ──signs EIP-712 meta-tx──▶ Relayer API (RELAYER_API_KEY) ──▶ deposit wallet deploy + approvals onchain (gas paid by Polymarket)

hot path (npm run bet)
  Fordefi vault ──signs EIP-712 order───▶ CLOB API ──▶ order matched off-chain, funded by the deposit wallet
```

Because the hot path is a single Fordefi message signature per order, order throughput is bounded only by your API Signer's signing rate (roughly ~6 signatures/second) — not by block times, gas, or transaction broadcasting.

## How it works

- Every Polymarket API account owns a **deposit wallet** — an ERC-1967 proxy deployed at a deterministic address, holding the account's pUSD and outcome tokens. New API accounts *must* trade through it: the CLOB rejects plain-EOA makers with `maker address not allowed, please use the deposit wallet flow` (existing/grandfathered EOA, proxy, and Safe accounts are unaffected).
- Orders are signed by the vault with `SignatureTypeV2.POLY_1271` and `funderAddress` = the deposit wallet; `@polymarket/clob-client-v2` automatically wraps the signature (ERC-7739) so the deposit wallet can validate it via ERC-1271.
- The relayer executes onchain transactions gaslessly on the deposit wallet's behalf (deployment, approvals, transfers) — it cannot place CLOB orders; those are always off-chain signatures. The relayer also **whitelists** approval targets: only current-generation Polymarket contracts are allowed (and the V3 exchange only as a pUSD spender, not a CTF operator).

## Authentication model

The CLOB uses two auth layers with very different security weights:

| | L1 — vault signature | L2 — API credentials |
|---|---|---|
| What it is | An EIP-712 `ClobAuth` message signed by the Fordefi vault | A `{key, secret, passphrase}` triple; every CLOB request is HMAC-signed with the secret |
| Used for | Creating/deriving/deleting the L2 credentials — once per wallet | Authenticating every API call: reading the account, syncing balances, submitting and canceling orders |
| Where it lives | Never leaves Fordefi's MPC | `fordefi_secret/clob-creds.json` (gitignored; delete to force re-derivation) |

The key point: **L2 credentials alone cannot move funds.** Every order is itself an EIP-712 message that must be signed by the vault — the L2 layer just transports it, and the exchange validates the wrapped signature on-chain against the deposit wallet's owner. If `clob-creds.json` leaked, an attacker could read positions and cancel open orders, but could not place a valid order or withdraw anything without also getting a signature out of the Fordefi vault — which stays behind your API Signer and policy engine.

Because the credentials are deterministic per wallet, this example derives them once (a single `ClobAuth` signature) and caches them — repeat runs need zero vault signatures beyond the orders themselves. The `RELAYER_API_KEY` is a third, independent credential: it only authorizes gasless *transaction relaying*, and every relayed transaction still requires the vault's EIP-712 signature to execute.

## Prerequisites

1. A Fordefi EVM vault + API user token + API Signer ([setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)).
2. A **Relayer API key**: connect the Fordefi wallet on polymarket.com, then create the key under **Profile → Settings → Relayer API keys**. The key is bound to the address that creates it — the relayer rejects transactions signed by any other address, so it must be created by the vault.

## Setup

```bash
npm install
```

Create `.env` (see `.env.example`):

```bash
FORDEFI_API_USER_TOKEN=     # Fordefi API user token
FORDEFI_EVM_VAULT_ADDRESS=  # Fordefi EVM vault address (Polygon)
RPC_URL=                    # Polygon RPC URL
RELAYER_API_KEY=            # from polymarket.com → Settings → API Keys
RELAYER_API_KEY_ADDRESS=    # address the key was created with (must be the vault)
```

Place the API Signer private key at `./fordefi_secret/private.pem`.

> **Note:** order posting is geoblocked by Polymarket in some regions (the CLOB returns HTTP 403) — run from a permitted region.

## Run it

One-time gasless setup — derives the vault's deposit wallet, deploys it if needed, sets any missing pUSD/outcome-token approvals through the relayer, and syncs the CLOB's balance view. Re-running is a no-op:

```bash
npm run setup
```

Fund the printed deposit-wallet address with pUSD (`0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB` on Polygon), then place orders:

```bash
npm run bet
```

The bet script buys "Yes" on the most recent active market with a limit order at the current price, sized to just clear Polymarket's $1 minimum order value — edit `src/run.ts` to change the strategy.

## Project layout

```text
src/config.ts                Fordefi + CLOB + relayer configuration
src/get-provider.ts          Fordefi Web3 provider factory
src/get-polymarket-client.ts CLOB client factory (clob-client-v2)
src/get-relay-client.ts      Relayer client factory (RELAYER_API_KEY header auth)
src/get-market.ts            Finds a recent market that is genuinely accepting orders
src/setup.ts                 One-time gasless deposit-wallet setup via the relayer
src/run.ts                   Order placement (deposit-wallet funded, POLY_1271)
```
