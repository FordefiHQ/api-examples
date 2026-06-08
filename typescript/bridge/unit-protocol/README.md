# Unit Protocol / Hyperunit Bridge

A standalone Fordefi example for the **Unit protocol / Hyperunit** bridge, which mints Hyperliquid deposit addresses on native chains. This example bridges **Bitcoin → Hyperliquid**. It ships configured for **mainnet** (real BTC) and can be switched to testnet with a single setting — see [Switching networks](#switching-networks).

> ⚠️ **Loss of funds warning (Unit protocol policy):**
> - Any deposit **under 0.0003 BTC** will result in a **loss of funds** — it is below the protocol's minimum and will not be credited or refunded.
> - Deposits sent **from a network other than the expected source chain** will result in a **loss of funds**. Only send the exact asset on the exact chain the deposit address was generated for.

## How It Works

The flow has three steps:

1. **Generate** — request a BTC deposit address from the Hyperunit API for a given Hyperliquid destination address.
2. **Verify** — confirm the deposit address is authentic by checking the ECDSA P-256 signatures returned by Hyperunit's guardian nodes against their known public keys. A quorum of at least 2 guardians must sign (`GUARDIAN_SIGNATURE_THRESHOLD`).
3. **Fund** — *only if verification passes* — submit a native BTC transfer to the verified address via the Fordefi Direct API, then poll until the transaction is `pushed_to_blockchain` and print a [mempool.space](https://mempool.space) explorer link.

Step 2 guards against a man-in-the-middle returning an attacker-controlled deposit address: you only fund an address that a threshold of guardians has signed.

## Setup

```bash
npm install
```

Create a `.env` file with:

| Variable | Description |
| --- | --- |
| `FORDEFI_API_USER_TOKEN` | Fordefi API User access token |
| `FORDEFI_BITCOIN_VAULT_ADDRESS` | Source Bitcoin vault address |
| `FORDEFI_BITCOIN_VAULT_ID` | Source Bitcoin vault ID |
| `HYPERLIQUID_ADDRESS` | Destination Hyperliquid address the deposit credits |
| `BTC_TRANSFER_AMOUNT` | Amount to send, in **satoshis**. Must be ≥ `30000` (0.0003 BTC, the Unit minimum) — `run.ts` aborts below it. |

Place your API Signer private key at `./secret/private.pem`.

> See the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker) for obtaining credentials.

## Run

```bash
npm run fund   # generate + verify + fund a BTC deposit address
```

> ⚠️ **As shipped (mainnet), this moves REAL BTC** once verification passes. Switch to testnet first (see below) if you don't intend to spend real funds.

## Tracking your deposit

`npm run fund` prints a `mempool.space` link, but that only tracks the Bitcoin transaction's confirmations — it does **not** tell you whether Unit has credited your Hyperliquid balance. For that, poll Hyperunit's [operations endpoint](https://docs.hyperunit.xyz/developers/api/operations), keyed on your **Hyperliquid destination address**:

```bash
# mainnet (testnet: https://api.hyperunit-testnet.xyz)
curl https://api.hyperunit.xyz/operations/<HYPERLIQUID_ADDRESS>
```

The response is `{ addresses, operations }`. Find the operation whose `sourceTxHash` starts with the hash `run.ts` printed (Unit appends a `:<vout>` output index, e.g. `…c063abce:0`), and watch its `state` field progress:

```
sourceTxDiscovered → waitForSrcTxFinalization → buildingDstTx → signTx
  → broadcastTx → waitForDstTxFinalization → readyForWithdrawQueue
  → queuedForWithdraw → done
```

`done` means the funds have landed on Hyperliquid; `failure` means the operation failed. Useful fields on each operation: `sourceTxConfirmations` (BTC confirmations Unit has seen), `destinationTxHash` (the credit on Hyperliquid), `sourceAmount` / `destinationFeeAmount` / `sweepFeeAmount`, and `positionInWithdrawQueue`. The endpoint returns `400 {"error": "Invalid input address"}` for a malformed address.

## Project Layout

```
src/
  run.ts            # entry point — orchestrates generate → verify → fund
  config.ts         # central config (chain, endpoints, push mode) loaded from .env
  get-address.ts    # GETs the deposit address from the Hyperunit API
  verify-data.ts    # guardian signature verification (P-256 / SHA-256)
  constants.ts      # hardcoded guardian public keys, quorum threshold, min deposit
  interfaces.ts     # Proposal, VerificationResult, FordefiApiConfig types
  api_request/      # Fordefi Direct-API layer
    buildPayload.ts   # builds the native BTC transfer payload
    signer.ts         # RSA-SHA256 request signing
    pushToApi.ts      # POSTs the transfer to api.fordefi.com
    getTransaction.ts # polls the transaction for its on-chain hash
```

## Switching networks

Network selection is a **single switch** — the `NETWORK` const in `src/config.ts`:

```ts
const NETWORK: Network = "mainnet"   // or "testnet"
```

Everything else is derived from it: the Bitcoin chain the vault funds on (`fordefiConfig.chain`), the Hyperunit API host, and the guardian key set used for verification. There's no second place to keep in sync — so you can't end up verifying a mainnet address while funding a testnet vault (or vice-versa). Always test end-to-end with small amounts after switching.

> ⚠️ Wrong-network deposits are **lost, not refunded** under Unit's policy — only ever fund a deposit address on the same network it was generated and verified against.
