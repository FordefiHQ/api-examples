# XRP Ledger (Ripple) via Fordefi

TypeScript recipes for the three XRP Ledger transaction types the [Fordefi](https://docs.fordefi.com/developers/program-overview) API exposes, plus a read-only helper for finding claimable checks. One npm project; all recipes share the API client in [`fordefi/`](./fordefi).

| Recipe | API operation | XRPL primitive | Run |
|---|---|---|---|
| [`transfer-xrp.ts`](./src/transfer-xrp.ts) | `ripple_transfer` (native) | `Payment` | `npm run transfer:xrp` |
| [`transfer-token.ts`](./src/transfer-token.ts) | `ripple_transfer` (trust-line asset) | `Payment` | `npm run transfer:token` |
| [`create-trustline.ts`](./src/create-trustline.ts) | `ripple_create_trustline` | `TrustSet` | `npm run trustline` |
| [`list-claimable-checks.ts`](./src/list-claimable-checks.ts) | `GET /transactions` | — (read-only) | `npm run checks:list` |
| [`cash-check.ts`](./src/cash-check.ts) | `ripple_cash_check` | `CheckCash` (+ `TrustSet` if needed) | `npm run check:cash` |

Fordefi builds and signs the XRPL transaction itself — there is no `ripple_raw_transaction` request type, so these recipes only construct API payloads and need no `xrpl` dependency.

## Predict, then send

Every write recipe first calls `POST /api/v1/transactions/predict` and prints the predicted transfers, balance changes, trust line changes and fees, then signs and broadcasts:

```bash
npm run transfer:xrp                # predict, then sign and broadcast
npm run transfer:xrp -- --dry-run   # predict only, nothing is created
```

`DRY_RUN=1` works in place of `--dry-run`. A dry run never reaches the signing phase, so it works with the API Signer stopped — useful for checking a payload before any key is involved.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a **Ripple vault** in Fordefi and fund it. On testnet, use an [XRP faucet](https://xrpl.org/resources/dev-tools/xrp-faucets).

3. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
   Set `FORDEFI_API_USER_TOKEN`, `FORDEFI_RIPPLE_VAULT_ID` and `NETWORK` (`ripple_testnet` by default), plus the vars for the recipe you want to run.

4. Set up an API Signer and pair your API User with it ([docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)).

5. Place your API User private key at `fordefi/secret/private.pem`.

6. Make sure your API Signer is running (not needed for `--dry-run` runs).

## Amounts

Every amount the API accepts or returns — `value`, `amount`, `diff`, `fee_charged` — is an **integer count of the asset's smallest units**, i.e. 10^-decimals of one token. The `value` field is typed `^\d+$`, so a decimal amount is a schema error rather than a rounding one. Read the scale off `asset_info.decimals` (`GET /api/v1/vaults/{id}/assets`); don't assume it.

**Every recipe passes amounts through in smallest units.** `RIPPLE_XRP_AMOUNT` and `RIPPLE_TOKEN_AMOUNT` go to `value` unscaled, so the number you set is the number that reaches the ledger. No recipe converts a display amount — do that in your own code if you need to; `assertBaseUnits()` only rejects a non-integer before the API does.

Native XRP has 6 decimals, so its base unit is the familiar **drop**. XRPL trust-line assets have **15 decimals** — not the token's display precision — which is the one that catches people out:

| env var | value | delivers |
| --- | --- | --- |
| `RIPPLE_XRP_AMOUNT` | `1000000` | 1 XRP |
| `RIPPLE_TOKEN_AMOUNT` | `1000000000000000` | 1 USDC |
| `RIPPLE_TOKEN_AMOUNT` | `1` | 0.000000000000001 USDC |

Getting the token scale wrong is invisible from the API side — prediction and mined result both echo your unscaled figure, so a dust transfer looks identical to a real one. Only the ledger shows it: a `value: "1"` check reads `SendMax: 1000000000000000e-30`.

Printed amounts lead with the smallest-unit figure and put the decimal amount in parentheses (`1000000000000000 (1 USDC)`), so the number shown first is always the one the API uses. Every printer — the dry-run preview and the mined outcome alike — goes through [`fordefi/amounts.ts`](./fordefi/amounts.ts), which also collapses a max trust-line limit to `maximum` rather than printing 110 digits. The symbol and decimals live under `priced_asset.asset_info`, **not** on `priced_asset` — reading `priced_asset.symbol` silently yields `undefined`.

## XRPL specifics worth knowing

- **Reserves.** An account must keep the base reserve (~1 XRP) and every trust line it holds locks an additional owner reserve (~0.2 XRP). A transfer that would push the balance below the reserve fails; the recipes surface this as `insufficient_funds` or a `insufficient_funds_gas_and_value` reversion.
- **Unfunded destinations.** Sending less than the base reserve to an address that does not exist yet fails — XRPL will not create an under-reserved account.
- **Destination tags.** Most exchanges require one. Set `RIPPLE_DESTINATION_TAG`; it is sent as a numeric string.
- **Trust line limits.** `ripple_create_trustline` always opens the line at the maximum limit — the endpoint takes no limit parameter.
- **Mined is not the same as succeeded.** An XRPL transaction can be included in a ledger and still fail with a `tec` code. The client checks `mined_result_status` and `mined_result.reversion` and treats a reverted transaction as a failure, printing the `RippleReversionState` (e.g. `missing_recipient_trustline`).

## Checks: how inbound IOUs arrive without a trust line

An inbound trust-line transfer to a vault that has **no** trust line for that currency is delivered as an XRPL **Check** instead of a payment. Fordefi records it with `claim_status: "claimable"` and a `check_id`, and the funds are yours only once you cash it:

```bash
npm run checks:list                # find the claimable check(s) and their transaction IDs
npm run check:cash                 # CheckCash the one you picked
```

`ripple_cash_check` takes only `transaction_id` — the Fordefi UUID of the source `CheckCreate` transaction — which is why the listing recipe exists. Set `RIPPLE_CHECK_SOURCE_TX_ID` to choose explicitly; leave it unset and `check:cash` auto-selects when there is exactly one claimable check. When the vault still has no trust line, Fordefi pushes a `TrustSet` before the `CheckCash`, so a single request can produce two ledger transactions and two fees (`trustline_fee` in the result).

This is the XRPL counterpart to Stellar's claimable balances — see [`typescript/stellar/claim-claimable-balance`](../stellar/claim-claimable-balance).

### Finding a claimable check: two filters that do not work

`checks:list` queries `GET /transactions` by `vault_ids` and `chains` only, and filters the claim state client-side. The two query parameters that look like they belong there both drop the check:

- **`direction: "incoming"`** — direction is labelled per *organization*, not per vault. A check written from one of your vaults to another is `outgoing` on both, so an `incoming` filter hides every internal transfer, which is exactly what you use to test this flow. Instead, the recipe confirms the vault is the payee via `ripple_transaction_type_details.recipient.vault.id` — populated for external senders too, and it also stops the *sending* vault from listing a check it cannot cash.
- **`claimed: false`** — real and documented ("selects ones not yet settled"), but it does not cover Ripple. On `ripple_mainnet` and `ripple_testnet` both `true` and `false` match nothing, so adding it returns an empty page while a claimable check sits in the vault. It works for Stellar claimable balances and Canton transfers.

Because the claim state is filtered client-side, the recipe pages through the full result set rather than reading only the first page.

One display consequence: `expected_result` is returned by `POST /transactions/predict` only, not by `GET /transactions`, and a claimable check has no mined effects yet — its value moves at `CheckCash` time. So the listing has no amount to show and prints the check's identity plus the sender's note instead.

### Your own transfers can emit a check

The same thing happens in the outgoing direction. `PredictedRippleTransaction.claim_status` in the API spec reads: "the claim status the transaction will have if created. Set to `claimable` for trust line transfers **that will be delivered as a check** the recipient must cash."

So `npm run transfer:token` produces a `CheckCreate` rather than a settled payment whenever the destination has no trust line for the currency — the recipient then has to cash it before the funds are theirs. You do not opt into this and cannot suppress it; it follows from the recipient's ledger state. The dry run tells you which outcome you are about to get: the recipe prints a `Claim status:` line whenever the prediction returns one.

Note that a check is a *deferred authorization*, not an escrow. Nothing leaves the sending vault at `CheckCreate` time, so the vault balance stays spendable and the check can fail later if the funds are gone when the recipient cashes it. Each outstanding check also holds ~0.2 XRP of owner reserve on the sender.

### Cashing fails with `tecPATH_PARTIAL` when the writer cannot fund it

The deferred-authorization property has a sharp edge: because `CheckCreate` never moves or locks funds, XRPL happily lets a vault write a check for an IOU it **does not hold**, and nothing surfaces that until someone cashes it. The prediction reports `simulation_status: success` with a clean `-1 / +1` balance change, the transfer mines as `completed`, and the check sits there looking claimable.

`CheckCash` then fails with [`tecPATH_PARTIAL`](https://xrpl.org/docs/references/protocol/transactions/transaction-results/tec-codes#tecpath_partial) — the amount cannot be delivered because the writer's trust-line balance is short. Fordefi records that as:

| field | value |
| --- | --- |
| `state` | `completed_reverted` |
| `mined_result_status` | `success` ← the ledger accepted the transaction |
| `mined_result.reversion.state` | `transaction_rejected` |
| `mined_result.reversion.reason` | `tecPATH_PARTIAL` |

`pollUntilComplete()` treats `completed_reverted` as terminal failure and throws with the reason attached, so `npm run check:cash` reports it rather than claiming success. The fee is still charged and **the check is not consumed** — it stays `claimable` and can be cashed again once the writer is funded.

So before cashing, confirm the *writer* actually holds the currency (`GET /api/v1/vaults/{id}/assets`, or `account_lines` on the sending address). A check from a zero-balance sender is uncashable, and since the API has no `CheckCancel`, it cannot be cleaned up either — it just keeps holding ~0.2 XRP of the sender's owner reserve.

### Gap: there is no create-check operation

Fordefi's XRPL surface is **receive-side only for checks**. You can cash checks written to you, and you can emit one as a side effect of the transfer above, but you cannot deliberately write a check as a spending authorization. Verified against the API spec:

- The `ripple_transaction` details discriminator has exactly three mappings — `ripple_transfer`, `ripple_create_trustline`, `ripple_cash_check`. There is no fourth.
- `CheckCreate` appears once in the whole spec, in the description of `CreateRippleCashCheckRequest.transaction_id`. It is only ever referenced as something that already happened.
- No `ripple_raw_transaction` **request** type exists (`RippleRawTransactionDetails` is response-only), so a locally-built `CheckCreate` cannot be submitted through a raw path either.
- The generic `POST /api/v1/transactions/transfer` endpoint does accept a Ripple asset identifier, but it is the same transfer with a smaller field set (`amount`, `asset_identifier`, `to`, `memo`, `fee_payer`) — no check control, and no destination tag.

Consequence: XRPL Checks are not usable through this API as an allowance primitive, in the way an SPL token delegation or an ERC-20 `approve` would be. There is also no `CheckCancel`, so a check emitted by a transfer cannot be withdrawn through the API once it exists.

**Untested escape hatch.** Black-box vaults support `eddsa_ed25519` and `ecdsa_secp256k1`, both valid XRPL signing schemes, and `black_box_signature` signs an arbitrary `hash_binary` payload. In principle you could build a `CheckCreate` locally, have Fordefi sign its hash, then assemble and broadcast it yourself — the pattern used by [`typescript/black-box/near`](../black-box/near). This has not been verified for XRPL, and it gives up policy simulation and the enriched transaction view, since the vault only ever sees an opaque hash.

## Shared client

[`fordefi/`](./fordefi) holds the API client used by every recipe:

- `signer.ts` — RSA SHA256 signing of the Fordefi request payload (`path|timestamp|requestBody`)
- `interfaces.ts` — types for the Ripple request and response schemas
- `amounts.ts` — smallest-unit rendering shared by every printer (`formatAmount`, `formatLimit`, `fromBaseUnits`)
- `api-client.ts` — `predictTransaction`, `createTransaction`, `getTransaction`, `listTransactions`, `pollUntilComplete`, `submitTransaction`, `describeOutcome`
- `key-loader.ts` — reads `fordefi/secret/private.pem`
- `index.ts` — barrel re-export

Only the write endpoints need the `x-signature` / `x-timestamp` headers; `predict` and the `GET` endpoints are bearer-only, so the client keeps `authHeaders()` and `signedAuthHeaders()` separate. `POST /transactions` also carries a generated `x-idempotence-id` so a retried create cannot double-spend.

## Reference

- [Fordefi API reference](https://docs.fordefi.com/api/openapi) — schemas `CreateRippleTransactionRequest`, `CreateRippleTransferRequest`, `CreateRippleTrustlineRequest`, `CreateRippleCashCheckRequest`, `RippleTransaction`
- [XRPL docs](https://xrpl.org/docs) — [Payment](https://xrpl.org/docs/references/protocol/transactions/types/payment), [TrustSet](https://xrpl.org/docs/references/protocol/transactions/types/trustset), [CheckCash](https://xrpl.org/docs/references/protocol/transactions/types/checkcash), [reserves](https://xrpl.org/docs/concepts/accounts/reserves)
