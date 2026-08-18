# Stellar sponsored reserves from a Fordefi vault

Creates a brand-new Stellar account **with zero XLM of its own** plus a trustline,
with a Fordefi vault paying all the base reserves.

[Sponsored reserves](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves)
(CAP-33) let one account carry the minimum-balance cost of another account's
ledger entries. The sponsored account's `numSponsored` cancels out its own
`numSubEntries`, so its minimum balance stays at zero — it can hold assets
without ever holding XLM.

## Transaction flow

The account and trustline are created in one four-operation sponsorship
"sandwich" 🥪 :

| # | Operation | Source | Purpose |
|---|---|---|---|
| 0 | `BeginSponsoringFutureReserves(sponsoredId)` | **Vault** (envelope source) | Open sponsorship |
| 1 | `CreateAccount(destination, startingBalance: "0")` | Vault | Create the account without funding it |
| 2 | `ChangeTrust(asset)` | **Sponsored account** | Add the sponsored trustline |
| 3 | `EndSponsoringFutureReserves` | **Sponsored account** | Close sponsorship |

The sandwich must remain in one transaction: Stellar does not allow an open
sponsoring relationship at the end of a transaction.

### Signing order

Both accounts must authorize their sourced operations. The sponsored account is a
locally held ed25519 keypair—not another Fordefi vault—so the signatures can be
collected in this order:

| Step | Action |
|---|---|
| 1 | Build the envelope with the Fordefi vault as its source. |
| 2 | Ask Fordefi to sign with `push_mode: "manual"` and `fail_on_prediction_failure: false`. |
| 3 | Compare Fordefi's returned envelope with the submitted envelope. |
| 4 | Sign the returned envelope with `SPONSORED_ED25519_SECRET`. |
| 5 | Broadcast the fully signed envelope directly to Horizon. |

Fordefi may refresh the sequence or normalize the fee before signing. The script
therefore signs the returned envelope, not the submitted one. `diffEnvelopes()`
logs acceptable fee/sequence changes but aborts if the operation count, order,
type, or source changes.

The vault named by `vault_id` must be the envelope source. A second Fordefi vault
cannot co-sign that envelope because Fordefi rejects it with
`INVALID_VAULT_FIELD`. See the [parent README](../README.md#limitation-a-vault-only-signs-envelopes-it-is-the-source-account-of).

### Reserve cost

| Sponsored entry | Reserve units | Locked by vault |
|---|---:|---:|
| Account | 2 | 1.0 XLM |
| Trustline | 1 | 0.5 XLM |
| **Total** | **3** | **1.5 XLM** |

`num_sponsoring` and `num_sponsored` count reserve units, not entries. The vault's
1.5 XLM is **locked, not spent**: its minimum balance rises, while its ledger
balance changes only by the transaction fee (about 400 stroops for this flow).

## What works with what

| Operation | Required authorization | Two Fordefi vaults | Vault + external key |
|---|---|---|---|
| **Sponsor** another account | Sponsor (`Begin`) + sponsored (`End`) | ❌ `INVALID_VAULT_FIELD` ✓ | ✅ `npm run sponsor` ✓ |
| **Transfer** to a new sponsor | Old + new sponsor | ❌ `INVALID_VAULT_FIELD` ✓ | Possible; not implemented |
| **Revoke** sponsorship | Sponsor only | ✅ | ✅ `npm run revoke` ✓ |
| **Remove / merge** entries | Sponsored account | ✅ if it sources the envelope | ✅ `npm run merge` ✓ |

✓ means verified on Stellar mainnet in this project. Sponsoring or transferring
between two Fordefi vaults is blocked because both parties must sign. Revoke and
removal are unilateral, so an existing vault-to-vault sponsorship can still be
unwound.

## Setup

```bash
npm install
npm run gen-keypair          # prints a G... public key and S... secret seed
cp .env.example .env         # add the generated seed and vault details
npm run sponsor
```

| Environment variable | Required | Purpose / default |
|---|:---:|---|
| `FORDEFI_API_USER_TOKEN` | Yes | Fordefi API User token |
| `FORDEFI_STELLAR_VAULT_ID` | Yes | Sponsoring vault ID |
| `STELLAR_VAULT_ADDRESS` | Yes | Sponsoring vault's `G...` address; must be the envelope source |
| `SPONSORED_ED25519_SECRET` | Yes | Sponsored account's `S...` seed from `npm run gen-keypair` |
| `STELLAR_ASSET_CODE` | Yes | Trustline asset code |
| `STELLAR_ASSET_ISSUER` | Yes | Trustline issuer's `G...` address |
| `STELLAR_HORIZON_URL` | No | `https://horizon.stellar.org` |
| `STELLAR_EXPLORER_URL` | No | `https://stellar.expert/explorer/public` |
| `STELLAR_TX_TIMEOUT_SECS` | No | `3600` seconds |

The API signer key is shared across the Stellar examples and read from
`../fordefi/secret/private.pem`.

| Requirement | Detail |
|---|---|
| API Signer | Must be running; a transaction stuck at `approved` with no signature usually means it is offline. |
| Vault balance | Current minimum balance plus at least **1.5 XLM** of headroom. |
| Network | Mainnet only: `stellar_mainnet` and `Networks.PUBLIC` are hardcoded. |
| Timeout | Keep the 3600-second default generous; expiry before broadcast causes `tx_too_late`. |

`SPONSORED_ED25519_SECRET` controls the sponsored account and any assets it holds.
Treat it as a production credential.

## Commands

| Command | Purpose | Push mode | Signatures |
|---|---|---|---|
| `npm run gen-keypair` | Generate the sponsored account locally | None | None |
| `npm run sponsor` | Create the account and trustline | Manual | Vault, then sponsored key |
| `npm run revoke` | Move reserve responsibility to the sponsored account | Auto | Vault only |
| `npm run merge` | Remove the trustline and account, releasing reserves | Manual | Vault, then sponsored key |

## Sequence numbers are the thing that will bite you

Fordefi assigns the sequence itself, as `max(the sequence you submitted, its own
next free one)`. A manual-push transaction that reaches `signed` reserves that
sequence until it is consumed.

| Situation | Sequence effect | Action |
|---|---|---|
| Signed but not broadcast | Fordefi keeps the reservation; later transactions may get `tx_bad_seq` | Broadcast reservations in ascending sequence order |
| Included on-chain, even with an operation failure | Sequence is consumed | No allocator gap remains |
| Rejected before consensus (`tx_bad_seq`, `tx_bad_auth`) | Sequence is not consumed | Fix the envelope and clear the reserved sequence |
| Past `maxTime` and unbroadcast | Cannot be broadcast; allocator recovery is untested | Avoid this state by using a generous timeout |

A signed transaction cannot be aborted: the API only permits aborting
`WAITING_FOR_APPROVAL` or `APPROVED`. The only verified recovery is broadcasting
the stuck envelopes in ascending sequence order. Even an on-chain failure such as
`op_already_exists` consumes its sequence and can close the gap.

`npm run sponsor` and `npm run merge` check for stuck signed transactions before
submitting another one. Do not walk away from a manual-push transaction before it
has been broadcast.

## Managing sponsorship

Choose the action based on the desired account lifecycle:

| Goal | Action | Requirement | Result |
|---|---|---|---|
| Keep the account running without vault sponsorship | Fund it with its full minimum balance, then `npm run revoke` | 1.5 XLM for this account and trustline | Reserve obligation moves to the account |
| Release the vault's 1.5 XLM of reserve capacity | `npm run merge` | Trustline balance must be zero; no unknown subentries | Trustline and account entry are removed |
| Move reserves to a new external sponsor | Transfer sponsorship | External sponsor signature; not implemented here | Account remains intact |
| Move reserves to another Fordefi vault | Not supported | Would require both vaults to sign one envelope | `INVALID_VAULT_FIELD` |

### Revoke sponsorship

`npm run revoke` uses `push_mode: "auto"` and needs only the vault's signature.
Revocation does **not** release the reserve obligation; it moves that obligation to
the sponsored account. An unfunded account therefore fails with
`revokeSponsorshipLowReserve`.

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
