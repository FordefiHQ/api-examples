# Stellar sponsored reserves from a Fordefi vault

Creates a brand-new Stellar account **with zero XLM of its own** plus a trustline,
with a Fordefi vault paying all the base reserves.

[Sponsored reserves](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves)
(CAP-33) let one account carry the minimum-balance cost of another account's
ledger entries. The sponsored account's `numSponsored` cancels out its own
`numSubEntries`, so its minimum balance stays at zero — it can hold assets
without ever holding XLM.

## What this does

One transaction, four operations — the "sandwich":

| # | Operation | Source |
| - | --------- | ------ |
| 0 | `BeginSponsoringFutureReserves(sponsoredId)` | **vault** (envelope source) |
| 1 | `CreateAccount(destination, startingBalance: "0")` | vault |
| 2 | `ChangeTrust(asset)` | **sponsored account** |
| 3 | `EndSponsoringFutureReserves` | **sponsored account** |

The sandwich has to be one transaction: no is-sponsoring-future-reserves-for
relationship may still be open when a transaction ends.

**Cost.** The vault locks **1.5 XLM** — 2 reserve units for the account (1.0) plus
1 for the trustline (0.5) — plus ~400 stroops of fee. The XLM is locked, not
spent: the vault's `num_sponsoring` and minimum balance both rise.

Getting it back is not a `RevokeSponsorship` — revoking only moves the obligation
onto the sponsored account, and fails outright if that account can't fund itself.
Returning the XLM to the vault means removing the entries. See
[Revoking](#revoking-npm-run-revoke--verified).

## What works with what

Every sponsorship operation is defined by *which account must source which
operation*, and that determines who has to sign. Since a Stellar envelope can
carry at most one Fordefi vault signature, that in turn decides whether a given
counterparty pairing is possible at all.

| Operation | Who must sign | Two Fordefi vaults | Vault + external key |
|---|---|---|---|
| **Sponsor** — take on another account's reserves | sponsor (`Begin`) + sponsored (`End`) | ❌ refused, `INVALID_VAULT_FIELD` ✔ | ✅ `npm run sponsor` ✔ |
| **Transfer** — hand the obligation to a new sponsor | old sponsor + new sponsor | ❌ refused, `INVALID_VAULT_FIELD` ✔ | ✅ in principle; not implemented |
| **Revoke** — stop carrying the reserves | sponsor only | ✅ | ✅ `npm run revoke` ✔ |
| **Remove / merge** — delete the entries | sponsored only, if it also sources the envelope | ✅ | ✅ `npm run merge` ✔ |

✔ = verified on mainnet in this project. Unmarked cells are read off the CAP-33
sourcing rules and Fordefi's source-account check, not tested.

Two things fall out of this:

- **You can get out of a vault-to-vault sponsorship, but never into one.** The
  operations that establish or move a sponsorship need both parties; the ones that
  end it need only one. That asymmetry is why this example sponsors a freshly
  generated keypair rather than an existing vault.
- **Revoke succeeds only if the sponsored account can fund its own minimum
  balance.** It moves the obligation rather than releasing it, so against an
  account created with a zero starting balance it fails with
  `revokeSponsorshipLowReserve` regardless of who signs.

## Why this needs two signatures, and why that's fine

Sponsorship requires **both** accounts to sign: the sponsor authorises
`BeginSponsoringFutureReserves`, the sponsored account authorises
`EndSponsoringFutureReserves`.

That sounds like it should collide with the limitation documented in
[`../setup-multisig/README.md`](../setup-multisig/README.md) — Fordefi rebuilds
every Stellar envelope before signing (refreshed sequence, normalized fee), so a
vault can't add its signature to a transaction hash someone else fixed in advance.
It doesn't collide, for two reasons:

1. **These are two different accounts, not two signers on one account.** There is
   no `SetOptions`, no threshold change, and no multisig account anywhere in this
   flow. The sponsored account is a keypair you generate with `npm run gen-keypair`
   and hold locally — not a second custodial signer.
2. **Signing order sidesteps the rebuild.** The vault signs *first*, with
   `push_mode: "manual"` so Fordefi hands the envelope back instead of
   broadcasting an under-signed transaction. We then attach the sponsored
   account's signature to *Fordefi's* envelope — the one it actually signed — and
   submit to Horizon ourselves. Appending a decorated signature doesn't change the
   transaction hash, so both signatures validate against the same envelope.

This is the same trick as [`../multisig-tx`](../multisig-tx), which does it for a
genuine 2-of-2 account.

It is also why this example sponsors a **freshly generated keypair** rather than an
existing Fordefi vault. Sponsoring a second vault would need both vaults to sign
one envelope — `Begin` sourced by the sponsor, `End` by the sponsored account — and
that is refused with `INVALID_VAULT_FIELD` (verified). The sponsored side has to be
a key you can sign with locally.

### What is still blocked

Sponsor **and** sponsored both being Fordefi vaults. The second vault would have
to sign the first vault's already-finalised envelope, and every route is closed:
`stellar_raw_transaction` on a non-source vault is rejected with
`INVALID_VAULT_FIELD`; `stellar_message` domain-separates its input with SEP-53
so the signature won't satisfy Horizon's protocol-hash check; and
`black_box_signature` needs a BlackBox vault, not a Stellar one. See
[`../setup-multisig/README.md`](../setup-multisig/README.md).

## The envelope diff

Because Fordefi rebuilds the envelope, `diffEnvelopes()` in `src/lib.ts` compares
what we submitted against what came back — source, fee, sequence, time bounds,
memo, and every operation's type and source — and prints the result.

Sequence and fee changes are expected and only logged. Any change to the
**operation list** aborts the run before broadcast: if Fordefi reordered the
sandwich, dropped an operation, or re-sourced `EndSponsoringFutureReserves` to the
vault, the transaction would no longer do what was asked, and there is no point
paying to find out on-chain.

This is the part worth reading in the output. Nothing else in
`typescript/stellar/` sends a multi-operation envelope or an operation whose
source differs from the vault, so Fordefi's behaviour on both is what this example
actually establishes.

## Setup

```bash
npm install
npm run gen-keypair          # prints the keypair for the account to be sponsored
cp .env.example .env         # fill it in, including SPONSORED_ED25519_SECRET
npm run sponsor
```

If `npm run sponsor` refuses to run because of stuck transactions, see
[Sequence numbers](#sequence-numbers-are-the-thing-that-will-bite-you).

| env | |
| --- | --- |
| `FORDEFI_API_USER_TOKEN` | required |
| `FORDEFI_STELLAR_VAULT_ID` | the sponsoring vault |
| `STELLAR_VAULT_ADDRESS` | the vault's `G...`; must be the envelope source |
| `SPONSORED_ED25519_SECRET` | `S...` seed from `npm run gen-keypair` |
| `STELLAR_ASSET_CODE` / `STELLAR_ASSET_ISSUER` | trustline asset (example: Circle USDC) |
| `STELLAR_HORIZON_URL` | default `https://horizon.stellar.org` |
| `STELLAR_EXPLORER_URL` | default `https://stellar.expert/explorer/public` |
| `STELLAR_TX_TIMEOUT_SECS` | default `3600` |

The API signer key is shared across the Stellar examples and read from
`../fordefi/secret/private.pem`.

Preconditions:

- The API Signer must be running. A transaction that sits at `approved` with no
  signatures means it's offline.
- The vault needs its own minimum balance **plus ≥1.5 XLM** of headroom.
- Mainnet only — `stellar_mainnet` and `Networks.PUBLIC` are hardcoded, matching
  the sibling examples.

The default 3600s timeout is deliberate: the other examples use `setTimeout(180)`,
which is tight once you add a Fordefi sign round trip *and* your own broadcast.
Blowing through it means `tx_too_late`.

## Verified behaviour

Run against `stellar_mainnet` on 2026-08-18, tx
[`5dc7d3af…`](https://stellar.expert/explorer/public/tx/5dc7d3afccbfc9a264437abcc316a36e35109afd011b07fa98adcb828d76afb5).
Nothing else in `typescript/stellar/` exercises these paths, so this is where the
answers come from:

- **Multi-operation envelopes are accepted.** Four operations, no complaint.
- **Operation-level source accounts other than the vault are accepted.**
  `INVALID_VAULT_FIELD` applies to the *envelope* source only; ops 2 and 3 sourced
  by the sponsored account went through.
- **The rebuild preserves the sandwich.** Operation count, order, types and per-op
  sources all came back unchanged. On this run the fee was untouched (400 in, 400
  out) and the sequence was returned as submitted.
- **`fail_on_prediction_failure: false` is required and sufficient.** The envelope
  is under-signed when Fordefi predicts it; without this the request aborts.

Result on-chain — the sponsored account ends up with a **minimum balance of zero**:

```
sponsored account  XLM 0.0000000, USDC trustline present, sponsor = the vault
  subentry_count 1, num_sponsored 3, num_sponsoring 0
  min balance = (2 + 1 + 0 - 3) x 0.5 = 0 XLM
sponsor vault      num_sponsoring 4 -> 7, min balance 7 -> 8.5 XLM
```

Note `num_sponsoring` / `num_sponsored` count **reserve units, not ledger
entries**: an account entry is worth 2 and each subentry 1, so this sandwich is
3 units — 1.5 XLM.

## Sequence numbers are the thing that will bite you

Fordefi assigns the sequence itself, as `max(the sequence you submitted, its own
next free one)`. It keeps its own allocator, and **a transaction that reaches
`signed` under `push_mode: "manual"` holds its sequence whether or not it is ever
broadcast.** Nothing releases it automatically — not even once the transaction's
own `maxTime` has passed.

So every abandoned attempt permanently widens the gap between the chain and
Fordefi's allocator, and because the rule is `max()` you cannot submit your way
back down. Once the gap exists, every later transaction fails with `tx_bad_seq`.

This is not specific to sponsored reserves — it applies to any manual-push Stellar
flow, [`../multisig-tx`](../multisig-tx) included.

`npm run sponsor` checks for this before submitting and refuses to run while a
gap exists, rather than widening it by one. It prints what is holding which
sequence:

```
On-chain sequence 268775449906118658 — the network will accept 268775449906118659 next.
Transactions stuck in `signed` on this vault: 5
  seq=268775449906118659  f7dc9bda-...  <= broadcastable now
  seq=268775449906118660  71a7664f-...  blocked (1 ahead)
  ...
```

**A stuck `signed` transaction cannot be aborted.** `POST /transactions/{id}/abort`
returns 400 `invalid_transaction_state` — *"Can only abort WAITING_FOR_APPROVAL or
APPROVED transaction"* — so once Fordefi has signed, the reservation cannot be
released through the API.

The only way to clear one is to **broadcast it**. A transaction that fails on-chain
still consumes its sequence number, which is all that is needed: verified by
clearing a stray sandwich whose account already existed, which landed as
`tx_failed` / `op_already_exists` for 400 stroops and closed the gap. Broadcast in
ascending sequence order, starting from the one matching the chain's next sequence.

The unresolved case is a stuck transaction past its `maxTime`: it can no longer be
broadcast, and there is no abort. Whether Fordefi's allocator ever recovers that
sequence is untested — so keep `STELLAR_TX_TIMEOUT_SECS` generous, and don't walk
away from a manual-push transaction you haven't broadcast.

## Revoking (`npm run revoke`) — verified

`RevokeSponsorship` is signed by the **sponsor alone**; the sponsored account
does not sign. So unlike `npm run sponsor` this needs no second signature, no
envelope recovery, and no manual push — Fordefi signs and broadcasts it in one
step with `push_mode: "auto"`, which also keeps its sequence allocator in step
with the chain.

**But revoking does not return XLM to the sponsor.** It transfers the reserve
*obligation* to the sponsored account, which must then cover it from its own
balance. An account that was created with a zero starting balance cannot, and
the operation fails.

Verified on mainnet 2026-08-18, tx
[`d5ee3d59…`](https://stellar.expert/explorer/public/tx/d5ee3d591d4c7468f664bf82d27bd85c5275e895e7b32087396f11008fd93d87):

```
op[0] revokeSponsorship -> revokeSponsorshipLowReserve
op[1] revokeSponsorship -> revokeSponsorshipLowReserve
transaction result: txFailed   (200 stroops charged, sequence consumed)
```

The sponsored account held 0 XLM and would have needed 1.5 to stand on its own.
Note the transaction was *included* in the ledger and consumed its sequence
number — an operation-level failure like this does not create the allocator gap
described above; only pre-consensus rejections (`tx_bad_seq`, `tx_bad_auth`) do.

So there are two different goals and two different instruments:

| Goal | How |
| --- | --- |
| Stop the vault carrying the reserves; account survives on its own | Fund the sponsored account with its full minimum balance (1.5 XLM here), **then** `npm run revoke`. Vault is net −1.5 XLM. Vault signature only. |
| Get the 1.5 XLM back to the vault | Remove the entries instead: `ChangeTrust` to limit 0, then `AccountMerge` into the vault. Reserves return automatically as each entry disappears. Both operations are sourced by the sponsored account, so this route needs its signature — the same co-sign flow as `npm run sponsor`. The account entry is deleted, though the address can be recreated later. |

## Reclaiming the reserves (`npm run merge`) — verified

Removing a sponsored entry ends the sponsorship and returns its reserve to the
sponsor. No revoke, no funding, nothing stranded. Two operations, both sourced by
the sponsored account, so this uses the same co-sign flow as `npm run sponsor`:

```
op[0]  ChangeTrust(asset, limit 0)   source = sponsored   -> releases 0.5 XLM
op[1]  AccountMerge(-> vault)        source = sponsored   -> releases 1.0 XLM
```

Order is forced: `AccountMerge` fails with `ACCOUNT_MERGE_HAS_SUB_ENTRIES` while
any subentry remains, and `ChangeTrust` to limit 0 fails while the trustline holds
a balance. The script checks both up front, and refuses if the account carries
trustlines it doesn't know how to remove.

Verified on mainnet 2026-08-18, tx
[`a743550e…`](https://stellar.expert/explorer/public/tx/a743550e85419cde180e727dca53c4dee45960c3f73ee0d6281c8ea10bcdb713):

```
op[0] changeTrust  -> changeTrustSuccess
op[1] accountMerge -> accountMergeSuccess        (200 stroops)

sponsored account   404 — deleted
vault  num_sponsoring  7 -> 4
       minimum balance 8.5 -> 7 XLM     (1.5 XLM freed)
       XLM balance     95.7046498 -> 95.7046298   (fee only)
```

Note what did and didn't move: the vault's **balance** barely changed, because the
reserves were never spent — they were locked. What changed is the **minimum
balance**, and therefore how much of the balance is spendable. That is the whole
economic shape of sponsorship, and it's why "reclaiming" shows up as a drop in
`num_sponsoring` rather than an incoming payment.

### Destructive, but not permanent

`AccountMerge` deletes the account **entry**, not the keypair. The same address can
be recreated later with `CreateAccount` — verified here: this account was merged,
then re-created from the same `SPONSORED_ED25519_SECRET` by re-running
`npm run sponsor`, and came back with `min balance 0` exactly as before. A
recreated account starts from a sequence number derived from the current ledger,
so envelopes signed for its previous incarnation cannot be replayed.

What the merge actually costs you is the account's **configuration**: the trustline
goes with it and must be re-established (and re-sponsored) if you revive the
address, along with any signers, offers or data entries. Payments sent to the
address while no account exists fail with `op_no_destination` rather than
vanishing.

So the choice between merge and fund-then-revoke isn't "destroy vs preserve" — the
address survives either way. It's whether the account keeps running continuously
under its own reserves, or is torn down now and rebuilt later if needed.

## Transferring to another sponsor — not possible between vaults

Transferring is the third instrument, and on the ledger side it is the best one
for this job: the reserve moves sponsor-to-sponsor and never lands on the
sponsored account, so unlike a revoke it works against a zero balance, and unlike
a merge it destroys nothing. Per CAP-33 the **new** sponsor sponsors the **old**
one, and revoking inside that sandwich transfers the entry rather than removing it:

```
Begin(sponsoredId = old sponsor)   source: NEW sponsor
RevokeSponsorship(trustline)       source: old sponsor
RevokeSponsorship(account)         source: old sponsor
End()                              source: old sponsor
```

The sponsored account is not a party and does not sign. The signatures required
are the **old and new sponsors** — which is what makes it impossible here: a
Stellar envelope can carry at most one Fordefi vault signature. Verified on
mainnet 2026-08-18; offering such a sandwich to the second sponsor's vault is
refused at creation with `HTTP 400 INVALID_VAULT_FIELD`. See
[`../README.md`](../README.md#limitation-a-vault-only-signs-envelopes-it-is-the-source-account-of).

Two things that would work, neither implemented here:

- **New sponsor as an external ed25519 key**, co-signed locally the way
  `npm run sponsor` does.
- **`npm run merge`, then have the new sponsor run `npm run sponsor` itself** —
  two transactions, and the account is recreated rather than preserved.

## Files

- `src/config.ts` — env loading and validation
- `src/gen-keypair.ts` — generates the sponsored account's keypair (local only)
- `src/lib.ts` — sandwich construction, Fordefi signing, envelope diff, signature attach, broadcast, verification
- `src/run.ts` — end-to-end entry point
- `src/revoke.ts` — revoke the sponsorship (vault signature only; fails unless the sponsored account is funded)
- `src/merge.ts` — remove the trustline and merge the account, returning the reserves to the vault
