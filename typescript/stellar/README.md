# Stellar via Fordefi

TypeScript examples for creating Stellar transactions through the [Fordefi](https://docs.fordefi.com/developers/program-overview) API. Each example is a self-contained npm project; they import a shared API client from [`fordefi/`](./fordefi).

| Example | Operation | Run |
|---|---|---|
| [`change-trust/`](./change-trust) | `stellar_change_trust` — establish a classic-asset trustline | `npm run trust` |
| [`claim-claimable-balance/`](./claim-claimable-balance) | `stellar_claim_claimable_balance` — claim claimable balances (auto-trustline if needed) | `npm run claim` |
| [`raw-transaction/`](./raw-transaction) | `stellar_raw_transaction` — submit a locally-built unsigned XDR | `npm run raw` |
| [`sign-message/`](./sign-message) | `stellar_message` — sign an arbitrary message (no broadcast) | `npm run sign` |
| [`sponsored-reserves/`](./sponsored-reserves) | `stellar_raw_transaction` — sponsor another account's base reserves (CAP-33) | `npm run sponsor` |

## Limitation: a vault only signs envelopes it is the source account of

`stellar_raw_transaction` requires the vault named in `vault_id` to be the
transaction envelope's **source account**. Hand a vault an envelope sourced by any
other account and it is refused at creation time:

```
HTTP 400  Invalid field: INVALID_VAULT_FIELD
  source account mismatch: XDR source GAQGT3TU... does not match vault GAT7T5PA...
```

A second, independent barrier sits behind that one. Fordefi processes the envelope
before signing and controls the sequence selection. It may refresh the sequence or
normalize the fee; either change produces a different transaction hash and voids
any signature collected against the submitted envelope. Even when the returned
values happen to match, there is no API contract that lets a second vault add its
signature to the first vault's finalized envelope.

Together these mean:

> **A Stellar transaction envelope can carry at most one Fordefi vault signature.**

Any Stellar operation that requires two vaults to sign is therefore impossible
today. Two that come up in practice:

- **2-of-2 multisig with two vaults as signers.** An account configured this way
  cannot transact through the current public API.
- **One vault sponsoring another vault's reserves.** CAP-33 pins both ends of the
  sandwich: `BeginSponsoringFutureReserves` must be sourced by the sponsor and
  `EndSponsoringFutureReserves` by the sponsored account, so both sign. Verified —
  offering such a sandwich to the second vault is refused with
  `INVALID_VAULT_FIELD`. This is why
  [`sponsored-reserves/`](./sponsored-reserves) sponsors a freshly generated
  keypair rather than an existing vault.
- **Transferring sponsorship from one vault to another.** Also signed by *both*
  the old and new sponsor — see
  [`sponsored-reserves/`](./sponsored-reserves#transferring-to-another-sponsor--not-possible-between-vaults).

[`sponsored-reserves/README.md`](./sponsored-reserves#what-works-with-what) carries
a matrix of which sponsorship operations work with two vaults versus a vault plus
an external key.

The reverse direction is not symmetric. *Removing* a sponsored entry does not need
the sponsor's signature — the reserve simply returns to them — so a sponsored vault
can drop its own trustline, or merge itself away, with only its own signature, by
sourcing the envelope itself. You can get out of a vault-to-vault sponsorship
unilaterally; you just cannot get into one.

Neither is a Stellar restriction — the ledger would accept both. The constraint is
Fordefi's.

### Working around it

The counterparty has to be an **external ed25519 key** rather than a second vault.
Order the signatures so the vault goes first, and the rebuild stops mattering:

1. Build the envelope locally with the vault as source account.
2. Submit it with `push_mode: "manual"` so Fordefi signs but does not broadcast.
3. Read back `serialized_signed_transaction` — Fordefi's rebuilt envelope, with the
   vault's signature already embedded.
4. Attach the external key's signature to *that* envelope. Appending a decorated
   signature does not change the transaction hash, so both signatures validate.
5. Broadcast to Horizon yourself.

[`sponsored-reserves/`](./sponsored-reserves) demonstrates this for the two-account
sponsorship sandwich.

Set `fail_on_prediction_failure: false` on the request — the envelope is
deliberately under-signed when Fordefi simulates it, and the request otherwise
aborts.

> **Manual push reserves a sequence number.** A transaction that reaches `signed`
> holds its sequence even if it has not been broadcast, and the API provides no
> release mechanism — aborting is rejected past `approved`. The only verified way
> to clear one is to broadcast it; a transaction that *fails* on-chain still
> consumes its sequence, which is enough. An under-signed envelope cannot be
> cleared this way, because `tx_bad_auth` is rejected before consensus and never
> consumes the sequence. Recovery after the envelope's `maxTime` has passed remains
> untested. See
> [`sponsored-reserves/README.md`](./sponsored-reserves#sequence-numbers-are-the-thing-that-will-bite-you).

## Shared client

[`fordefi/`](./fordefi) holds the API client used by every example:

- `signer.ts` — RSA SHA256 signing of the Fordefi request payload (`path|timestamp|requestBody`)
- `interfaces.ts` — TypeScript types covering `CreateStellarTransactionRequest`, `CreateStellarMessageRequest`, asset identifiers, claim sources, dapp info, and the response shape
- `api-client.ts` — `createTransaction`, `getTransactionStatus`, `pollUntilComplete`, `submitTransaction`
- `index.ts` — barrel re-export

Each project imports it via relative path (`../../fordefi/index.js`).

## Per-project setup

The API User private key is shared across every example. Place it once at:

```text
stellar/fordefi/secret/private.pem
```

Then, inside each example directory:

```bash
npm install
cp .env.example .env          # then fill in tokens, vault id, asset/destination
```

See each project's README for the env vars it expects.

## Reference

- [Fordefi API docs](https://docs.fordefi.com/api/openapi)
- [Stellar SDK docs](https://stellar.github.io/js-stellar-sdk/)
