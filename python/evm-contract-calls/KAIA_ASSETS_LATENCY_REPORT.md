# How fast does `GET /vaults/{id}/assets` reflect a balance change?

Benchmark of Fordefi's vault-assets endpoint against real ERC20 transfers on Kaia.

**Date:** 2026-08-05 · **Chain:** Kaia Mainnet (`evm_8217`) · **Asset:** USD₮ `0xd077A400968890Eacc75cdc901F0356c943e4fDb` (6 decimals)
**Harness:** [`kaia_usdt_benchmark.py`](kaia_usdt_benchmark.py) · **Samples:** 9 live transfers, 8 of them cleanly timed

---

## Headline findings

1. **Accuracy is perfect.** 9/9 transfers produced a balance delta of exactly `-100000` units, cross-checked
   against on-chain `eth_call balanceOf`. Final state agreed to the unit: on-chain `517305`, Fordefi `517305`.
   No sample was ever *wrong* — only late.

2. **`completed` is the reliable trigger; `mined` is a race.** Measured from the `completed` webhook,
   **3/3 immediate GETs already had the new balance** — waiting for `completed` never returned a stale figure.
   Measured from `mined`, **7 of 9 updated within ~1s but 2 took 29s and 77s.** If you read the balance when
   `mined` fires, roughly one time in four you get the old number.

3. **The refresh is not bound to a single state.** In 7 runs the balance moved ~0.3–1.1s after `mined`
   (long before `completed`). In 1 run it did not move until `completed` landed — 76.7s after `mined`, and
   within 1s of `completed`. Same payload, same vault, same asset. So the update fires at *either* boundary,
   and only `completed` is a guarantee.

4. **`state_changes[].changed_at` for `mined` is the block timestamp, not detection time.** Fordefi's `mined`
   webhook arrives 4.8–13.4s after the block it reports. For `completed`, `changed_at` and delivery are
   0.19–0.35s apart. Benchmarking the endpoint against `mined`'s `changed_at` therefore charges indexer
   detection lag to the API.

---

## Methodology

Each run submits one real `transfer(address,uint256)` of 0.1 USD₮ from vault `81e82853-…`
(`0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73`) to vault `c3317b70-…`
(`0xF659feEE62120Ce669A5C45Eb6616319D552dD93`), as an `evm_raw_transaction` with `push_mode: auto`.

From submission onward, **four observers run concurrently** on one `time.monotonic()` clock:

| Observer | Interval | Purpose |
|---|---|---|
| `poll_tx_state` | 1.0s | `GET /transactions/{id}` — records each state transition |
| `watch_webhooks` | 0.25s | Tails `typescript/webhooks/live_logs/fordefi/*.json` for deliveries |
| `poll_assets` | 1.0s | `GET /vaults/{id}/assets?chains=evm_8217` — timestamps the first changed value |
| `triggered_balance_check` | event | Waits for the `completed` webhook, then fires **one** immediate GET |

Concurrency matters: polling `/assets` continuously *from submission* rather than only after settlement is what
caught the runs where the balance updated at `mined`, long before `completed`. A sequential
"wait for completed, then GET" script would have reported those as instant and missed the mechanism entirely.

The last observer implements the originally requested protocol verbatim — wait for `COMPLETED`, then read the
balance — so the two approaches can be compared directly.

### Reading the numbers

- Balances come from `balances.total_mined` / `available_mined`. The top-level `"balance"` field reads `"0"`
  for every asset and is a decoy.
- Policy-approval time is measured separately and **excluded**. One transfer sat 287s in
  `waiting_for_approval`; counting that as latency would be meaningless.
- Latency granularity is bounded by the 1s assets poll, so figures are ±1s.
- Accuracy is asserted, not just reported: the delta must equal `-100000` exactly or the run prints MISMATCH.

### Reproducing

```bash
cd python/evm-contract-calls
uv run python kaia_usdt_benchmark.py --dry-run     # prints payload + decoded call data, spends nothing
uv run python kaia_usdt_benchmark.py --runs 3      # live; prints per-run timeline and a summary
```

Requires the webhook receiver running (`cd typescript/webhooks && npm run fordefi_server`) with a tunnel
whose URL matches an active Fordefi webhook subscribed to `enriched_transaction_state_update`.

---

## Results

### Final clean batch (3 runs, 08:18–08:23 UTC)

| Run | `mined` (webhook) | `completed` (webhook) | gap | `/assets` updated | vs `mined` | vs `completed` | triggered GET |
|---|---|---|---|---|---|---|---|
| 1 | +13.36s | +68.57s | 55.2s | +13.70s | **+0.34s** | −54.87s | ✅ reflected (0.31s) |
| 2 | +10.84s | +83.43s | 72.6s | +11.81s | **+0.96s** | −71.62s | ✅ reflected (1.02s) |
| 3 | +6.56s | +82.23s | 75.7s | +83.26s | **+76.70s** | **+1.03s** | ✅ reflected (0.33s) |

All three exact (`-100000`). Runs 1–2 updated right after `mined`; run 3 waited for `completed`.

### All 9 transfers, latency from `mined`

```
+0.34, +0.62, +0.81, +0.96, +1.11, −0.21, +29.24, +76.70, and one bracketed [10s, 74s]
```

Seven ≤ ~1.1s (one *negative* — the endpoint updated before the `mined` webhook arrived), two badly late.
Median ≈ +0.9s, but the distribution is bimodal, not a tight cluster with noise. **A median alone
misrepresents this endpoint**, which is why the harness prints every sample.

### Latency from `completed`

3/3 already reflected on the first immediate GET, with the GET itself taking 0.31–1.02s round-trip.
In runs 1–2 the balance had been correct for 55–72s by then.

---

## Explaining the outliers

The 29.24s outlier (run 6 of an earlier batch) initially looked like endpoint staleness. Its balance updated at
`08:07:23.42` — and the `completed` transition of a **different, concurrent transaction** from the same vault
(`10c37773-…`) is stamped `08:07:23.745`. The two coincide within ~0.3s. Combined with run 3 above, where the
balance moved only when that run's own `completed` arrived, the consistent reading is:

> A vault balance refresh is triggered at `mined` **and** at `completed`. The `mined`-time refresh is not
> guaranteed to land; when it doesn't, the balance waits for the next refresh trigger — which may be this
> transaction's `completed`, or another transaction's.

This is inferred from timing correlation across 9 transfers, not from Fordefi internals, so treat it as a
working model rather than documented behavior. The operational consequence holds regardless of mechanism.

---

## Recommendations

- **Key balance reads off the `completed` webhook**, not `mined`. It was correct 3/3 times with zero staleness,
  at the cost of 55–76s more wall clock on Kaia.
- **If you need the balance sooner than `completed`,** read at `mined` but re-read on `completed` — do not treat
  the `mined`-time value as authoritative. Better still, poll until the value changes rather than reading once.
- **Never anchor timing on `state_changes[].changed_at` for `mined`** — it is the block timestamp and runs
  4.8–13.4s ahead of when Fordefi actually knows.
- **Expect `mined` ≠ `completed` on Kaia**, separated by 55–76s. A terminal-state check that only looks for
  `completed` will poll for over a minute past settlement; one that only looks for `mined` never terminates.

## Caveats

- Single chain (Kaia), single asset, single vault pair, n=9. The bimodal pattern is clear but the *rate* of the
  slow mode (2/9 here) is not well estimated at this sample size.
- All transfers were outgoing from the measured vault; incoming-side behavior
  (`total_pending_incoming`) was not exercised — it stayed `0` throughout.
- The 287s `waiting_for_approval` on the first transfer to a previously-unused destination is unexplained.
  No `policy_match` and no approval request were recorded; subsequent transfers to the same address cleared in
  <1s. Suspected first-use destination handling, not proven, and unrelated to endpoint latency.
