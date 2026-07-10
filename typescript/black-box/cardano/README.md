# Cardano with Fordefi Black-Box Vault

ADA transfers, stake delegation, and reward withdrawal using a Fordefi black-box vault (`key_type=eddsa_ed25519`).

## Prerequisites

- Node.js
- A Fordefi black-box vault — [docs](https://docs.fordefi.com/developers/transaction-types/black-box-signing#black-box-vaults)
- A running Fordefi API Signer — [docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
- A [Blockfrost](https://blockfrost.io) project id (free tier is fine)
- ADA balance on the derived address
- API User private key at `./secret/private.pem`

To create the vault:

```bash
curl -X POST https://api.fordefi.com/api/v1/vaults \
  -H "Authorization: Bearer $FORDEFI_API_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "my-cardano-vault", "type": "black_box", "key_type": "eddsa_ed25519" }'
```

The response's `public_key_compressed` field (base64, 32 bytes) is your `VAULT_PUBLIC_KEY`.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
```

Required env vars:

| Variable | Purpose |
|---|---|
| `FORDEFI_API_USER_TOKEN` | API user bearer token |
| `BLACKBOX_VAULT_ID` | Vault ID for the black-box vault |
| `VAULT_PUBLIC_KEY` | 32-byte raw ed25519 pubkey (base64) — used to derive the Cardano address |
| `BLOCKFROST_PROJECT_ID` | Blockfrost project id (must match `CARDANO_NETWORK`) |
| `DESTINATION_ADDRESS` | Recipient Cardano address (`addr1...` on mainnet; transfers only) |
| `POOL_ID` | Stake pool to delegate to (`pool1...`; staking only) |
| `CARDANO_NETWORK` | `mainnet` or `preprod` |

Tunables (transfer amount, TTL buffer) live in `src/cardano-config.ts`.

## Usage

```bash
npm run derive      # print the addresses derived from VAULT_PUBLIC_KEY
npm run transfer    # ADA transfer
npm run delegate    # register the stake key (first time) + delegate to POOL_ID
npm run withdraw    # withdraw accumulated staking rewards
```

## How black-box signing works here

1. Build the transaction body locally with `@emurgo/cardano-serialization-lib-nodejs`: fetch UTxOs, protocol parameters, and the current slot from Blockfrost, then add the flow-specific pieces (a payment output, delegation certificates, or a reward withdrawal), select inputs, set the TTL, and add change.
2. Hash the exact body bytes with blake2b-256 (`FixedTransaction.transaction_hash()`), base64-encode, and POST to Fordefi as a `black_box_signature` payload. A Cardano vkey witness is precisely an ed25519 signature over this body hash, so black-box signing fits natively.
3. Poll Fordefi until the tx is `completed`; it returns a 64-byte ed25519 signature (base64).
4. Wrap the signature and the vault public key as a `Vkeywitness` and submit the raw CBOR to Blockfrost `/tx/submit`. One witness covers everything — inputs, certificates, and withdrawals — because the vault key is both the payment and the stake credential.

## Staking

The vault's single key hash is used as **both** the payment and the stake credential, giving a base address (`addr1q…`). ADA held at that address counts toward delegation. `npm run delegate` builds one transaction containing, as needed:

1. A stake-key **registration** certificate (first time only; locks the 2 ADA `key_deposit`, refunded on deregistration).
2. A **pool delegation** certificate for `POOL_ID`.
3. A **DRep vote delegation** to "always abstain" — required post-Conway for reward withdrawals to be accepted.

Rewards accrue to the stake address each epoch (first payout ~15–20 days after delegating). `npm run withdraw` withdraws the full reward balance (Cardano requires the exact amount); it lands back at the base address via the change output.

The Fordefi request itself is authenticated separately: `SHA256+RSA` over `${apiPath}|${timestamp}|${requestBody}` using the API user PEM key.

## Files

| File | Purpose |
|---|---|
| `cardano-config.ts` | Env loading and tunables |
| `cardano-address-utils.ts` | ed25519 pubkey → blake2b-224 key hash → base / enterprise / stake address |
| `cardano-serializer.ts` | Shared: fetch UTxOs/params/slot from Blockfrost, build + hash the tx body, build Fordefi payload |
| `cardano-flow.ts` | Shared: derive address → build → sign API request → submit → poll → broadcast |
| `cardano-transfer-run.ts` / `cardano-delegate-run.ts` / `cardano-withdraw-run.ts` | Thin entry points; each supplies the tx pieces for its flow |
| `signer.ts` | RSA signing of Fordefi API requests |
| `process_tx.ts` | Fordefi API HTTP wrapper |
| `broadcast-cardano-transaction.ts` | Polls Fordefi, assembles the vkey witness, submits to Blockfrost |
| `derive_cardano_address.ts` | Standalone address-derivation script |

## Notes

- All flows use the **base address** (`addr1q…`) printed by `npm run derive` — fund that one. The enterprise address (`addr1v…`) shown alongside it shares the same spending key but holds separate UTxOs and never earns rewards.
- Amounts on the wire are in **lovelace** (1 ADA = 1e6 lovelace).
- UTxOs holding native tokens are skipped when selecting inputs, so the example can never accidentally move them.
- Outputs below the min-UTxO floor (~1 ADA) are rejected by the network; the serializer guards this with `min_ada_for_output`.
- The tx TTL is set to current slot + 7200 (~2 hours). If Fordefi signing takes longer (e.g. a pending policy approval), submission fails with `OutsideValidityIntervalUTxO` — just rerun to rebuild.
- The same in-memory `FixedTransaction` is passed from the serializer through to broadcast: the signature is only valid for those exact body bytes, so never re-serialize/round-trip it.
