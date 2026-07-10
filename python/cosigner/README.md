# Fordefi CoSigner

A webhook-driven co-signing service that augments [Fordefi Policy](https://docs.fordefi.com/user-guide/policies) rules with custom programmatic validation, then approves or aborts transactions through the Fordefi API.

## Why a CoSigner?

Fordefi Policy rules cover most controls natively (recipients, amounts, contracts, dapps). Some checks, however, require parsing transaction content yourself, for example:

- A **deeply nested field inside an EIP-712 typed message** (e.g. the `receiver` of a DEX order)
- A **decoded contract-call argument** (e.g. the `dstReceiver` buried inside a 1inch swap struct)
- A **field inside borsh-encoded Solana instruction data** (e.g. the EVM `mint_recipient` of a CCTP bridge)
- Any cross-field or business-specific invariant

The CoSigner runs these checks in code. Set your policy rule to require approval by the CoSigner's API user; the transaction then only gets signed if both the native policy **and** your custom rules pass — programmatic defense in depth.

## How it works

```text
transaction created ──▶ Fordefi Policy: require approval ──▶ webhook fires
                                                                  │
        ┌─────────────────────────────────────────────────────────┘
        ▼
   CoSigner (this service)
        │ 1. verify webhook signature (ECDSA P-256)
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

## Prerequisites

- Python 3.10+ and [uv](https://docs.astral.sh/uv/)
- A Fordefi API user token — the API user must be added as an **approver in your policy rule's approval quorum**, so its approval counts
- A [Fordefi webhook](https://docs.fordefi.com/developers/webhooks) pointing at this service

## Setup

```bash
uv sync
cp .env.example .env   # then fill it in
```

| Variable | Description |
| -------- | ----------- |
| `FORDEFI_API_USER_TOKEN` | Access token of the CoSigner's Fordefi API user |
| `ORIGIN_VAULT` | Your authorized vault address |
| `FORDEFI_PUBLIC_KEY_PATH` | Fordefi's webhook signing key (defaults to `./public_key.pem`) |
| `LOG_LEVEL` | Log verbosity: `DEBUG`, `INFO`, `WARNING`, `ERROR` (defaults to `INFO`) |
| `LOG_DIR` | Directory for the persisted audit log, rotated daily (defaults to `./live-logs`) |
| `LOG_RETENTION_DAYS` | Days of rotated audit logs to retain (defaults to `90`) |

Run it:

```bash
uv run uvicorn cosigner:app --host 0.0.0.0 --port 8080
```

Expose it for testing and point your Fordefi webhook at the public URL:

```bash
ngrok http 8080
```

## Built-in example rules

All rules live in [`rules/`](rules/) and run in order for every transaction in `waiting_for_approval` state. Each returns `PASSED`, `SKIPPED` (doesn't apply), or `ABORT`.

| Rule | Checks |
| ---- | ------ |
| [`eip712_receiver`](rules/eip712_receiver.py) | EIP-712 order `message.receiver` must be the origin vault (or the zero-address placeholder) |
| [`calldata_contains_vault`](rules/calldata_contains_vault.py) | Contract calls must reference the origin vault somewhere in their calldata (ERC-20 approvals exempt, detected via Fordefi's `parsed_data.method`) |
| [`oneinch_swap_receiver`](rules/oneinch_swap_receiver.py) | 1inch AggregationRouterV6 swaps (`0x07ed2379`): the `dstReceiver` decoded from the swap struct must be the transaction initiator |
| [`cctp_bridge_recipient`](rules/cctp_bridge_recipient.py) | Solana→Ethereum USDC bridges via Circle CCTP V2 (`depositForBurn`): the `mint_recipient` decoded from the instruction data must be the origin vault — unknown CCTP instructions, non-Ethereum destination domains, and non-USDC burns are aborted |

### How the CCTP bridge rule works

Fordefi returns Solana transactions with their instructions pre-parsed (`program` address, base64 `data`, `account_indexes`), so no Solana SDK is needed. The rule finds every instruction targeting the CCTP V2 TokenMessengerMinter program, checks the 8-byte Anchor discriminator (`sha256("global:deposit_for_burn")[:8]`), then reads the fixed borsh layout: `amount u64 · destination_domain u32 · mint_recipient 32B · destination_caller 32B · max_fee u64 · min_finality_threshold u32`. The `mint_recipient` is a 32-byte value (12 zero bytes + 20-byte EVM address) compared against `ORIGIN_VAULT`, and the burned token account at index 10 must be the USDC mint.

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

Semantics: return `SKIPPED` when the rule doesn't apply, `ABORT` when it applies and the check fails **or can't be completed** (fail closed — a rule that raises is also treated as `ABORT`). The first `ABORT` aborts the transaction.

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

Unknown selectors are not decoded and do **not** abort by themselves — rules skip them. If you want a strict allowlist (abort anything you can't decode), add a one-line rule:

```python
def require_known_selector(context: RuleContext) -> RuleResult:
    if context.transaction.get("hex_data") and context.decoded_call is None:
        return RuleResult.abort("calldata selector is not in the ABI registry")
    return RuleResult.passed()
```

## Webhook endpoint semantics

Fordefi retries webhook deliveries (with backoff) on any non-2xx response. The CoSigner uses that deliberately:

| Response | Meaning |
| -------- | ------- |
| `200` | Decision made (approved/aborted) or nothing to do (wrong state, no tx id) |
| `400` | Body isn't JSON |
| `401` | Missing or invalid `X-Signature` — check your public key configuration |
| `403` | Request didn't come from Fordefi's webhook source IP (`54.243.103.88`) |
| `503` | Couldn't fetch the transaction from the Fordefi API → Fordefi retries |
| `500` | Approve/abort API call failed → Fordefi retries (safe: the fresh-state check skips already-decided transactions) |

`GET /health` returns `{"status": "online"}`.

## Event logging

The CoSigner logs through Python's standard [`logging`](https://docs.python.org/3/library/logging.html) module (timestamped, leveled), not bare `print`, so output flows into `journald`/Docker/your log aggregator without extra wiring. Named loggers sit under a shared `cosigner` hierarchy — `cosigner` (webhook lifecycle and decisions), `cosigner.api` (approve/abort calls), `cosigner.rules` (per-rule verdicts), and `cosigner.signature`. Set `LOG_LEVEL` to control verbosity.

Every line is written to both the console **and** a persisted, rotating audit log under `LOG_DIR` (default `./live-logs`) for auditability. The file rotates daily at UTC midnight — the active day is `live-logs/cosigner.log`, prior days are suffixed (`cosigner.log.2026-07-03`) — and files older than `LOG_RETENTION_DAYS` (default 90) are pruned. `live-logs/` is git-ignored so audit output is never committed. `LOG_DIR` defaults to a project-relative path; in production point it at a durable, append-only location (e.g. `/var/log/cosigner`) and back it up.

A single transaction produces a traceable sequence of events:

```text
2026-07-03 12:00:01 INFO    cosigner        Received webhook id=wh_123 event=ev_456
2026-07-03 12:00:01 INFO    cosigner        Validating transaction tx_789
2026-07-03 12:00:01 INFO    cosigner.rules  [eip712_receiver] skipped: no EIP-712 payload
2026-07-03 12:00:01 INFO    cosigner.rules  [calldata_contains_vault] abort: vault not referenced in calldata
2026-07-03 12:00:01 INFO    cosigner.api    Aborting transaction tx_789: vault not referenced in calldata
2026-07-03 12:00:01 INFO    cosigner.api    Transaction tx_789 abort succeeded
2026-07-03 12:00:01 INFO    cosigner        Decision tx=tx_789 decision=aborted reason=vault not referenced in calldata
```

Rejected requests (unauthorized IP, missing/invalid signature) log at `WARNING`; failed API calls log at `ERROR`. A rule that raises logs a full traceback before failing closed.

> **Want a persistent audit trail?** The `Decision tx=... decision=... reason=...` line is the natural hook — swap that `logger.info(...)` in `cosigner.py` for a write to an append-only JSONL file (or ship it to your SIEM) to keep a durable, queryable record of every co-signing decision.

## Testing

Unit tests cover all rules, the fail-closed runner, and the ABI registry (including verifying the 1inch selector against a computed keccak hash):

```bash
uv run pytest
```

End-to-end testing uses real, signed webhooks — the source-IP and signature checks always run (a webhook signature can't be forged without Fordefi's private key, so there is no bypass flag). Expose the service via ngrok, configure the webhook, and create a low-value transaction from the configured vault through a policy that requires the CoSigner's approval — then one that violates a rule, and watch it get aborted.

## Production deployment

### systemd service

```ini
[Unit]
Description=Fordefi CoSigner
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/cosigner
Environment="PATH=/path/to/cosigner/.venv/bin"
ExecStart=/path/to/cosigner/.venv/bin/uvicorn cosigner:app --host 0.0.0.0 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

### Hardening tips

- The app rejects requests not originating from Fordefi's webhook source IP (`54.243.103.88`, see `ALLOWED_SOURCE_IPS` in `fordefi/config.py`) — also enforce this at the firewall/security-group level for defense in depth. Note the check trusts `X-Forwarded-For` when present, which is only meaningful behind a proxy you control (ngrok, load balancer).
- Scope the API user's permissions to what a co-signer needs (approve/abort), nothing more

## Troubleshooting

- **Signature verification fails** — verify `FORDEFI_PUBLIC_KEY_PATH` points to a valid PEM of Fordefi's webhook public key.
- **400 errors on approve/abort in the logs** — expected when the transaction's state changed between the webhook and the API call (e.g. another approver acted first); the CoSigner treats these as no-ops.
- **A rule aborts everything** — remember rules fail closed: a rule that raises or can't resolve a required field aborts the transaction. Check the per-rule log lines (`[rule_name] verdict: reason`).

## Resources

- [Fordefi Developer Documentation](https://docs.fordefi.com/developers/program-overview)
- [Fordefi Transaction API](https://docs.fordefi.com/api/openapi/transactions)
- [Fordefi Webhooks](https://docs.fordefi.com/developers/webhooks)
