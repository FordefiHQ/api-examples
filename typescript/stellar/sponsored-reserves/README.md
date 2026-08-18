# Stellar sponsored reserves from a Fordefi vault

Creates a brand-new Stellar account **with zero XLM of its own** plus a trustline,
with a Fordefi vault paying all the base reserves.

[Sponsored reserves](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves)
(CAP-33) let one account carry the minimum-balance cost of another account's
ledger entries. Here, the sponsored account's `num_sponsored` offsets the reserve
units for its account entry and trustline, so its minimum balance stays at zero—it
can hold assets without holding XLM.

## Transaction flow

The account and trustline are created in one four-operation sponsorship
"sandwich" 🥪:

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
next free one)`. A manual-push transaction that reaches `signed` holds that
sequence while it remains unbroadcast. Consuming it on-chain is the only verified
release mechanism.

| Situation | Sequence effect | Action |
|---|---|---|
| Signed but not broadcast | Fordefi keeps the reservation; later transactions may get `tx_bad_seq` | Broadcast reservations in ascending sequence order |
| Included on-chain, even with an operation failure | Sequence is consumed | No allocator gap remains |
| Rejected before consensus (`tx_bad_seq`, `tx_bad_auth`) | Sequence is not consumed | Make the reserved envelope broadcastable; clear lower reservations first |
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

### Reclaim reserves with merge

`npm run merge` removes the sponsored entries, which lowers the vault's minimum
balance and makes the 1.5 XLM spendable again:

| Order | Operation | Source | Reserve released |
|---:|---|---|---:|
| 1 | `ChangeTrust(asset, limit: "0")` | Sponsored account | 0.5 XLM |
| 2 | `AccountMerge(destination: vault)` | Sponsored account | 1.0 XLM |

The trustline must hold zero tokens, and all subentries must be removed before
`AccountMerge`. The script refuses to proceed if it finds a funded trustline or an
unknown trustline it cannot remove.

`AccountMerge` deletes the account entry and its configuration—not its keypair. The
same address can be recreated later, but trustlines, signers, offers, and data must
be configured again. Payments sent while the account does not exist fail with
`op_no_destination`.

## Transferring to another sponsor — not possible between vaults

Transfer keeps the account intact and moves the obligation directly between
sponsors. It requires the **old and new sponsors** to sign; the sponsored account
is not involved.

| Operation | Source |
|---|---|
| `BeginSponsoringFutureReserves(oldSponsor)` | New sponsor |
| `RevokeSponsorship(trustline)` | Old sponsor |
| `RevokeSponsorship(account)` | Old sponsor |
| `EndSponsoringFutureReserves` | Old sponsor |

Two Fordefi vaults cannot provide those signatures on one envelope; the second
vault is rejected with `INVALID_VAULT_FIELD`. An external new sponsor could sign
locally, but that flow is not implemented. The supported alternative is to merge
the account and have the new sponsor recreate it.

## Verified behavior

Mainnet verification was performed on 2026-08-18:

| Scenario | Transaction | Result |
|---|---|---|
| Sponsor account + trustline | [`5dc7d3af…`](https://stellar.expert/explorer/public/tx/5dc7d3afccbfc9a264437abcc316a36e35109afd011b07fa98adcb828d76afb5) | Account created with 0 XLM and zero minimum balance; vault `num_sponsoring` increased by 3 units |
| Revoke while account has 0 XLM | [`d5ee3d59…`](https://stellar.expert/explorer/public/tx/d5ee3d591d4c7468f664bf82d27bd85c5275e895e7b32087396f11008fd93d87) | Included but failed with `revokeSponsorshipLowReserve`; sequence consumed |
| Remove trustline + merge | [`a743550e…`](https://stellar.expert/explorer/public/tx/a743550e85419cde180e727dca53c4dee45960c3f73ee0d6281c8ea10bcdb713) | Account removed; vault minimum balance fell by 1.5 XLM |
| Transfer between two Fordefi vaults | No transaction created | API refused the second vault with `INVALID_VAULT_FIELD` |

The sponsor run also verified that Fordefi accepts multi-operation envelopes and
operation-level sources other than the vault, preserves the sandwich's operation
order and sources, and proceeds when prediction failure is explicitly allowed.

## Files

| File | Responsibility |
|---|---|
| `src/config.ts` | Environment loading and validation |
| `src/gen-keypair.ts` | Local sponsored-account key generation |
| `src/lib.ts` | Transaction construction, signing, envelope comparison, broadcast, and verification |
| `src/run.ts` | End-to-end sponsorship flow |
| `src/revoke.ts` | Revoke sponsorship with the vault signature |
| `src/merge.ts` | Remove sponsored entries and release the vault's reserves |
