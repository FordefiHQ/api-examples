# Fordefi API Approver

A webhook-driven approval service that augments [Fordefi Policy](https://docs.fordefi.com/user-guide/policies) rules with custom programmatic validation, then approves or aborts transactions through the Fordefi API.

## What an API Approver is (and isn't)

An API Approver **does not sign anything**. From the [Fordefi docs](https://docs.fordefi.com/developers/transaction-types/build-custom-api-approver):

> An API Approver does **not** cryptographically sign transactions. It evaluates the transaction payload against your custom validation logic and either approves the transaction or aborts it using an API User token.

Signing stays with Fordefi's MPC infrastructure. This service is a voter in an approval quorum whose ballot happens to be cast by code — which is why its rules are a check layered *on top of* Policy, never a replacement for it.

## Why an API Approver?

Fordefi Policy rules cover most controls natively (recipients, amounts, contracts, dapps). Some checks, however, require parsing transaction content yourself, for example:

- A **deeply nested field inside an EIP-712 typed message** (e.g. the `receiver` of a DEX order)
- A **decoded contract-call argument** (e.g. the `dstReceiver` buried inside a 1inch swap struct)
- A **field inside borsh-encoded Solana instruction data** (e.g. the EVM `mint_recipient` of a CCTP bridge)
- Any cross-field or business-specific invariant

The API Approver runs these checks in code. Set your policy rule to require approval by the approver's API user; the transaction then only gets signed if both the native policy **and** your custom rules pass — programmatic defense in depth.

## How it works

```text
transaction created ──▶ Fordefi Policy: require approval ──▶ webhook fires
                                                                  │
        ┌─────────────────────────────────────────────────────────┘
        ▼
   API Approver (this service)
        │ 1. verify source IP, then webhook signature (ECDSA P-256)
        │ 2. GET /api/v1/transactions/{id}   ← fresh, authoritative data
        │ 3. run every rule in rules/ (fail closed)
        ▼
   all passed → approve        any rule aborts → abort
```

Design choices worth knowing:

- **Only accepts webhooks from Fordefi**: requests must originate from Fordefi's webhook source IP (`54.243.103.88`) *and* carry a valid ECDSA signature.
- **Validates against a fresh `GET /transactions/{id}` response**, never the webhook body alone. The webhook only triggers the flow; the API is the source of truth (and provides `parsed_data` — Fordefi's own calldata decoding — plus the full transaction object).
- **Fails closed.** If a rule applies to a transaction but can't complete its check (missing field, undecodable calldata, unexpected exception), the transaction is aborted, not waved through.
- **No external tooling.** Calldata is decoded in-process with [`eth-abi`](https://pypi.org/project/eth-abi/) against a small selector registry — no Foundry, no subprocesses, no third-party signature databases.

## Rules are a deny-list — read this before you rely on them

`run_rules` approves a transaction when **every rule returned `SKIPPED`**. Rules subtract from what Policy already allows; they do not enumerate what is permitted. So anything no rule recognises is approved by default: an unregistered contract selector, a transaction type nobody wrote a rule for, a plain native-value transfer with no calldata at all.

Two consequences to design around:

1. `validate_origin_vault` runs **first** in `ALL_RULES` precisely so that an unrecognised transaction is still pinned to the vault this approver was configured to guard. Keep it there.
2. If you want unrecognised *calldata* to abort rather than skip, add the strict-mode rule below. It is deliberately not enabled by default, because it aborts every contract call whose selector you have not registered.

```python
# rules/strict_mode.py — opt in by appending it to ALL_RULES
def require_known_selector(context: RuleContext) -> RuleResult:
    if context.transaction.get("hex_data") and context.decoded_call is None:
        return RuleResult.abort("calldata selector is not in the ABI registry")
    return RuleResult.passed()
```

Your Fordefi Policy rules remain the allow-list. This service narrows them; it does not define them.

## Prerequisites

- Python 3.10+ and [uv](https://docs.astral.sh/uv/)
- A Fordefi API user with the **Trader** role, added as an **approver in your policy rule's approval quorum** so its approval counts. It must never initiate transactions itself — it would end up voting on its own requests.
- A [Fordefi webhook](https://docs.fordefi.com/developers/webhooks) pointing at this service

## Setup

```bash
uv sync
cp .env.example .env   # then fill it in
```

| Variable | Description |
| -------- | ----------- |
| `FORDEFI_API_USER_TOKEN` | Access token of the approver's Fordefi API user |
| `ORIGIN_VAULT` | Your authorized vault address |
| `FORDEFI_PUBLIC_KEY_PATH` | Fordefi's webhook signing key (defaults to `./public_key.pem`) |
| `TRUST_PROXY_HEADER` | Trust `X-Forwarded-For` when resolving the caller's IP (defaults to `false` — see [Hardening](#hardening)) |
| `LOG_LEVEL` | Log verbosity: `DEBUG`, `INFO`, `WARNING`, `ERROR` (defaults to `INFO`) |
| `LOG_DIR` | Directory for the persisted audit log, rotated daily (defaults to `./live-logs`) |
| `LOG_RETENTION_DAYS` | Days of rotated audit logs to retain (defaults to `90`) |

Run it:

```bash
uv run uvicorn approver:app --host 0.0.0.0 --port 8080 --no-proxy-headers
```

**`--no-proxy-headers` is not optional.** Uvicorn enables its proxy-header middleware by default and trusts `X-Forwarded-For` from `127.0.0.1`, which means it rewrites `request.client.host` from a client-supplied header *before* this app sees the request — defeating `TRUST_PROXY_HEADER` and the IP allowlist. The flag hands IP resolution back to the app, which then decides based on your configuration. Keep it on every command line, including the systemd unit below.

Expose it for testing and point your Fordefi webhook at the public URL:

```bash
TRUST_PROXY_HEADER=true uv run uvicorn approver:app --host 0.0.0.0 --port 8080 --no-proxy-headers
ngrok http 8080
```

`TRUST_PROXY_HEADER=true` is required behind ngrok: the request reaches the app from `127.0.0.1`, and Fordefi's real IP only survives in `X-Forwarded-For`. Turn it back off for any deployment where the app is reachable directly.

## Built-in example rules

All rules live in [`rules/`](rules/) and run in order for every transaction in `waiting_for_approval` state. Each returns `PASSED`, `SKIPPED` (doesn't apply), or `ABORT`.

| Rule | Checks |
| ---- | ------ |
| [`origin_vault`](rules/origin_vault.py) | The transaction must be signed by `ORIGIN_VAULT`. Runs first; skips when the signing vault is on a different chain family than `ORIGIN_VAULT` (e.g. a Solana vault bridging to an EVM address), and aborts when the vault can't be resolved |
| [`eip712_receiver`](rules/eip712_receiver.py) | EIP-712 order `message.receiver` must be the origin vault (or the zero-address placeholder) |
| [`calldata_contains_vault`](rules/calldata_contains_vault.py) | Contract calls must reference the origin vault somewhere in their calldata (ERC-20 approvals exempt, detected via Fordefi's `parsed_data.method`) |
| [`oneinch_swap_receiver`](rules/oneinch_swap_receiver.py) | 1inch AggregationRouterV6 swaps (`0x07ed2379`): the `dstReceiver` decoded from the swap struct must be the transaction initiator |
| [`cctp_bridge_recipient`](rules/cctp_bridge_recipient.py) | Solana→Ethereum USDC bridges via Circle CCTP V2 (`depositForBurn`): the `mint_recipient` decoded from the instruction data must be the origin vault — unknown CCTP instructions, non-Ethereum destination domains, and non-USDC burns are aborted |

### Known limits of these example rules

They are illustrations of technique, not a finished control set:

- **`calldata_contains_vault` is a substring match.** The vault appearing *anywhere* in the calldata satisfies it — including as an unrelated argument or inside a nested byte blob — so it does not prove the vault is the recipient. Decode the specific field when that matters (see `oneinch_swap_receiver`).
- **Its ERC-20 approval exemption is broad.** An unbounded `approve(spender, MAX_UINT)` skips the check entirely, which is the calldata shape most often used to drain a wallet. Restrict *who* may be approved with a Fordefi Policy contract/dapp rule, or write a rule that decodes the spender. The skip is logged at `WARNING` so it is visible in the audit log every time it happens.
- **`ORIGIN_VAULT` is a single address.** A multi-chain setup needs a per-chain origin vault, or a lookup against `GET /api/v1/vaults?account_addresses=<address>` (pass the API client into the rule via `RuleContext`).
- **`ABI_REGISTRY` holds one selector.** 1inch V4/V5 (`0x7c025200`) is described in a comment but not registered, so those swaps are unvalidated. Strict mode above closes this class of gap.

### How the CCTP bridge rule works

Fordefi returns Solana transactions with their instructions pre-parsed (`program` address, base64 `data`, `account_indexes`), so no Solana SDK is needed. The rule finds every instruction targeting the CCTP V2 TokenMessengerMinter program, checks the 8-byte Anchor discriminator (`sha256("global:deposit_for_burn")[:8]`), then reads the fixed borsh layout: `amount u64 · destination_domain u32 · mint_recipient 32B · destination_caller 32B · max_fee u64 · min_finality_threshold u32`. The `mint_recipient` is a 32-byte value (12 zero bytes + 20-byte EVM address) compared against `ORIGIN_VAULT`, and the burned token account at index 10 must be the USDC mint.

Both the base64 decode and the account-index lookup are bounds-checked, so a crafted instruction aborts with a readable reason rather than an `IndexError` caught by the runner.

To accept *any* vault in your organization instead of a single configured address, look the recipient up with `GET /api/v1/vaults?account_addresses=<recipient>` and pass the API client into the rule via `RuleContext`.

## Writing your own rule

A rule is a plain function taking a `RuleContext` and returning a `RuleResult`:

```python
# rules/max_value.py
from .base import RuleContext, RuleResult

MAX_VALUE_WEI = 10**18  # 1 ETH

def validate_max_value(context: RuleContext) -> RuleResult:
    value = int(context.transaction.get("value") or 0)
    if value > MAX_VALUE_WEI:
        return RuleResult.abort(f"value {value} exceeds the {MAX_VALUE_WEI} wei limit")
    return RuleResult.passed()
```

Then register it in [`rules/__init__.py`](rules/__init__.py):

```python
ALL_RULES: list[Rule] = [
    ...,
    validate_max_value,
]
```

`RuleContext` gives you:

- `context.transaction` — the full `GET /api/v1/transactions/{id}` response, including Fordefi's `parsed_data` (decoded method name and typed arguments for verified contracts)
- `context.parsed_raw_data()` — the transaction's `raw_data` parsed as JSON (EIP-712 payloads), or `None`
- `context.decoded_call` / `context.decode_error` — locally decoded calldata (see below)
- `context.config` — your configuration (`origin_vault`, etc.)

`get_vault_address(transaction)` from [`rules/base.py`](rules/base.py) resolves the signing vault's address, handling the `managed_transaction_data` fallback.

Semantics: return `SKIPPED` when the rule doesn't apply, `ABORT` when it applies and the check fails **or can't be completed** (fail closed — a rule that raises is also treated as `ABORT`). The first `ABORT` aborts the transaction. Remember that an all-`SKIPPED` run is an approval.

### Decoding calldata for a new contract

Add the function's selector and signature to `ABI_REGISTRY` in [`rules/calldata.py`](rules/calldata.py):

```python
ABI_REGISTRY["0xa9059cbb"] = FunctionAbi(
    name="transfer",
    arg_names=("to", "amount"),
    arg_types=("address", "uint256"),
)
```

Your rule then reads `context.decoded_call.args["to"]` — typed values, no text scraping. Calldata is decoded once per transaction and shared across all rules.

Unknown selectors are not decoded and do **not** abort by themselves — rules skip them. Enable strict mode if you want that to be an abort.

## Webhook endpoint semantics

Fordefi retries webhook deliveries (with backoff) on any non-2xx response. The API Approver uses that deliberately:

| Response | Meaning |
| -------- | ------- |
| `200` | Decision made (approved/aborted) or nothing to do (wrong state, no tx id) |
| `400` | Body isn't JSON |
| `401` | Missing or invalid `X-Signature` — check your public key configuration |
| `403` | Request didn't come from Fordefi's webhook source IP (`54.243.103.88`) |
| `413` | Body exceeds `MAX_BODY_BYTES` (1 MiB) |
| `503` | Couldn't fetch the transaction from the Fordefi API → Fordefi retries |
| `500` | Approve/abort API call failed → Fordefi retries (safe: the fresh-state check skips already-decided transactions) |

Checks run in that order — source IP first, then the size cap, then the signature — so an unauthorized caller is rejected before the service reads or buffers a payload. Error responses carry static messages; upstream API detail stays in the logs rather than going back over the wire.

`GET /health` returns `{"status": "online"}`.

## Event logging

The API Approver logs through Python's standard [`logging`](https://docs.python.org/3/library/logging.html) module (timestamped, leveled), not bare `print`, so output flows into `journald`/Docker/your log aggregator without extra wiring. Named loggers sit under a shared `approver` hierarchy — `approver` (webhook lifecycle and decisions), `approver.api` (approve/abort calls), `approver.rules` (per-rule verdicts), and `approver.signature`. Set `LOG_LEVEL` to control verbosity.

Every line is written to both the console **and** a persisted, rotating audit log under `LOG_DIR` (default `./live-logs`) for auditability. The file rotates daily at UTC midnight — the active day is `live-logs/approver.log`, prior days are suffixed (`approver.log.2026-07-03`) — and files older than `LOG_RETENTION_DAYS` (default 90) are pruned. `live-logs/` is git-ignored so audit output is never committed. `LOG_DIR` defaults to a project-relative path; in production point it at a durable, append-only location (e.g. `/var/log/api-approver`) and back it up.

A single transaction produces a traceable sequence of events:

```text
2026-07-03 12:00:01 INFO    approver        Received webhook id=wh_123 event=ev_456
2026-07-03 12:00:01 INFO    approver        Validating transaction tx_789
2026-07-03 12:00:01 INFO    approver.rules  [validate_origin_vault] passed: signed by the origin vault 0x8BFC…
2026-07-03 12:00:01 INFO    approver.rules  [validate_eip712_receiver] skipped: no EIP-712 payload
2026-07-03 12:00:01 INFO    approver.rules  [validate_calldata_contains_vault] abort: origin vault not found in transaction calldata
2026-07-03 12:00:01 INFO    approver.api    Aborting transaction tx_789: origin vault not found in transaction calldata
2026-07-03 12:00:01 INFO    approver.api    Transaction tx_789 abort succeeded
2026-07-03 12:00:01 INFO    approver        Decision tx=tx_789 decision=aborted reason=origin vault not found in transaction calldata
```

Rejected requests (unauthorized IP, missing/invalid signature, oversized body) log at `WARNING`; failed API calls log at `ERROR`. A rule that raises logs a full traceback before failing closed. A skipped ERC-20 approval and a 400 from approve/abort both log at `WARNING` — neither is an error, but both are worth noticing if they become routine.

> **Want a persistent audit trail?** The `Decision tx=... decision=... reason=...` line is the natural hook — swap that `logger.info(...)` in `approver.py` for a write to an append-only JSONL file (or ship it to your SIEM) to keep a durable, queryable record of every approval decision.

## Testing

Unit tests cover all rules, the fail-closed runner, the ABI registry (including verifying the 1inch selector against a computed keccak hash), and the webhook authorization layer (source-IP resolution under both `TRUST_PROXY_HEADER` settings, and the body size cap):

```bash
uv run pytest
```

End-to-end testing uses real, signed webhooks — the source-IP and signature checks always run (a webhook signature can't be forged without Fordefi's private key, so there is no bypass flag). Expose the service via ngrok with `TRUST_PROXY_HEADER=true`, configure the webhook, and create a low-value transaction from the configured vault through a policy that requires the approver's approval — then one that violates a rule, and watch it get aborted.

## Production deployment

### systemd service

```ini
[Unit]
Description=Fordefi API Approver
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/api-approver
Environment="PATH=/path/to/api-approver/.venv/bin"
ExecStart=/path/to/api-approver/.venv/bin/uvicorn approver:app --host 0.0.0.0 --port 8080 --no-proxy-headers
Restart=always

[Install]
WantedBy=multi-user.target
```

### Hardening

Fordefi recommends three independent layers; combined, they mean a request has to come from Fordefi's network, prove Fordefi signed it, and the approver's token has to be usable only from your own host:

1. **Webhook signature verification** — always on, no bypass flag. This is the control that actually authenticates Fordefi.
2. **Inbound IP allowlisting** — the app rejects requests not originating from `54.243.103.88` (see `ALLOWED_SOURCE_IPS` in `fordefi/config.py`). Enforce it at the firewall/security-group level too. Two settings decide whether this layer is real:
   - Run uvicorn with **`--no-proxy-headers`**. Without it, uvicorn rewrites the client IP from `X-Forwarded-For` for any request arriving from `127.0.0.1`, so a local process — or a proxy on the same host — can present itself as Fordefi.
   - Leave **`TRUST_PROXY_HEADER=false`** unless a proxy you control overwrites `X-Forwarded-For`. The header is client-supplied, so trusting it on a directly-reachable service lets anyone claim Fordefi's IP.

   Treat this layer as advisory regardless: signature verification is what actually authenticates Fordefi.
3. **API User outbound IP restriction** — restrict the approver's API user to your host's egress IPs in Fordefi, so a leaked token can't be used from anywhere else.

Also:

- Scope the API user's permissions to what an approver needs (approve/abort), nothing more.
- **Replay:** there is no nonce or timestamp on webhook deliveries, so a captured `(body, X-Signature)` pair stays valid forever. What makes a replay harmless is the fresh `GET /transactions/{id}` state check — on replay the transaction has already left `waiting_for_approval`, so the handler returns without deciding anything. Don't remove that check.

## Troubleshooting

- **Every request gets a 403** — you're likely behind a proxy with `TRUST_PROXY_HEADER=false`. The logged IP will be your proxy's (`127.0.0.1` for ngrok) rather than Fordefi's.
- **Requests pass the IP check that shouldn't** — you're missing `--no-proxy-headers`, so uvicorn is resolving the IP from `X-Forwarded-For` instead of the app.
- **Signature verification fails** — verify `FORDEFI_PUBLIC_KEY_PATH` points to a valid PEM of Fordefi's webhook public key.
- **`WARNING ... state already changed or request rejected` on approve/abort** — expected occasionally when the transaction's state changed between the webhook and the API call (e.g. another approver acted first). If *every* decision logs this, the calls are being rejected rather than racing — check the API user's role and quorum membership.
- **A rule aborts everything** — remember rules fail closed: a rule that raises or can't resolve a required field aborts the transaction. Check the per-rule log lines (`[rule_name] verdict: reason`).

## Resources

- [Build a Custom API Approver](https://docs.fordefi.com/developers/transaction-types/build-custom-api-approver)
- [Fordefi Developer Documentation](https://docs.fordefi.com/developers/program-overview)
- [Fordefi Transaction API](https://docs.fordefi.com/api/openapi/transactions)
- [Fordefi Webhooks](https://docs.fordefi.com/developers/webhooks)
