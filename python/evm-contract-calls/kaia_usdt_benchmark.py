"""Benchmark how fast (and how accurately) GET /vaults/{id}/assets reflects an ERC20 balance change.

Moves USD₮ on Kaia out of SOURCE_VAULT_ID and, from the moment of submission, timestamps every
observable event on one monotonic clock:

  1. Fordefi transaction state transitions   (GET /api/v1/transactions/{id})
  2. Webhook deliveries                      (new files in typescript/webhooks/live_logs/fordefi/)
  3. The first /assets response that differs from baseline

Then reports the latency between "transaction completed" and "endpoint updated".

Run:  uv run python kaia_usdt_benchmark.py [--dry-run] [--runs N]
"""

import os
import sys
import json
import time
import asyncio
import argparse
import datetime
from pathlib import Path

import requests
from eth_abi import encode
from dotenv import load_dotenv

from utils.broadcast import broadcast_tx
from utils.sign_payload import sign_with_api_user_private_key

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fordefi_protocol_types import (  # noqa: E402
    TransactionType,
    SignerType,
    SignMode,
    PushMode,
    GasType,
    GasPriorityLevel,
    EvmTransactionDetailType,
    TransactionState,
)

load_dotenv()

## Fordefi configuration
API_USER_PRIVATE_KEY = Path("./secret/private.pem")
USER_API_TOKEN = os.environ["FORDEFI_API_TOKEN"]
BASE_URL = "https://api.fordefi.com"
CREATE_TX_PATH = "/api/v1/transactions"

## What we move
CHAIN = "evm_8217"  # Kaia's unique_id — a custom chain, so there is no evm_kaia_mainnet alias
SOURCE_VAULT_ID = "81e82853-3c4f-4cd4-b494-78fb4abf168a"  # 0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73
DEST_ADDRESS = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93"  # vault c3317b70-0509-41f8-be1e-e7c91e42281f
USDT = "0xd077A400968890Eacc75cdc901F0356c943e4fDb"  # "Tether USD" / USD₮ on Kaia
DECIMALS = 6
AMOUNT = 100_000  # 0.1 USD₮
CUSTOM_NOTE = "Kaia USD₮ assets-endpoint latency benchmark"

## Benchmark knobs
ASSETS_POLL_S = 1.0
TX_POLL_S = 1.0
WEBHOOK_POLL_S = 0.25
# Two separate budgets. A policy that requires manual approval can park the tx in
# waiting_for_approval for minutes; that wait must not eat the measurement budget, which only
# starts once the tx is actually moving toward the chain.
APPROVAL_TIMEOUT_S = 1800
MEASURE_TIMEOUT_S = 900
SETTLE_TAIL_S = 30.0  # keep polling /assets this long past the first change, to catch pending → mined
POST_COMPLETED_GRACE_S = 90.0  # after "completed", how long to keep waiting for the endpoint to move
WEBHOOK_LOG_DIR = (
    Path(__file__).resolve().parents[2] / "typescript" / "webhooks" / "live_logs" / "fordefi"
)

# Two settlement states matter, and they are far apart on Kaia (~60-90s):
#   mined     — the tx is in a block
#   completed — Fordefi considers it final, and this is what actually gates the balance refresh
# The benchmark anchors on "completed" (per the query.md protocol: wait for COMPLETED, then GET) but
# records "mined" too, so the two can be compared.
ANCHOR_STATE = TransactionState.COMPLETED.value
MINED_STATE = TransactionState.MINED.value
FAILURE_STATES = {
    TransactionState.ABORTED.value,
    TransactionState.FAILED.value,
    TransactionState.REJECTED.value,
    TransactionState.STUCK.value,
}
# States the tx passes through while still waiting on a policy decision, not on the chain.
PENDING_APPROVAL_STATES = {"waiting_for_approval", "waiting_for_signing_trigger"}


# ─────────────────────────────── payload ───────────────────────────────

def build_call_data() -> str:
    """ERC20 transfer(address,uint256) — encoded rather than hand-assembled so padding can't drift."""
    return "0xa9059cbb" + encode(["address", "uint256"], [DEST_ADDRESS, AMOUNT]).hex()


def build_request(call_data: str) -> dict:
    return {
        "signer_type": SignerType.API_SIGNER.value,
        "vault_id": SOURCE_VAULT_ID,
        "note": CUSTOM_NOTE,
        "sign_mode": SignMode.AUTO.value,
        "type": TransactionType.EVM_TRANSACTION.value,
        "details": {
            "fail_on_prediction_failure": False,
            "skip_prediction": False,
            "push_mode": PushMode.AUTO.value,  # Fordefi signs AND broadcasts
            "type": EvmTransactionDetailType.EVM_RAW_TRANSACTION.value,
            "chain": CHAIN,
            # No custom_nonce: let Fordefi assign it.
            # Kaia reports gas_type "dynamic", so priority gas — not a hardcoded legacy price.
            "gas": {
                "type": GasType.PRIORITY.value,
                "priority_level": GasPriorityLevel.MEDIUM.value,
            },
            "to": USDT,
            "value": "0",
            "data": {
                "type": "hex",
                "hex_data": call_data,
            },
        },
    }


# ─────────────────────────────── HTTP helpers ───────────────────────────────

def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {USER_API_TOKEN}"}


def fetch_assets() -> dict:
    """GET the vault's Kaia assets — the exact call query.md benchmarks. Bearer token only."""
    resp = requests.get(
        f"{BASE_URL}/api/v1/vaults/{SOURCE_VAULT_ID}/assets",
        params={"chains": CHAIN},
        headers=_auth_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def extract_usdt(assets: dict) -> dict:
    """Pull the USD₮ balances out of an /assets response.

    The top-level "balance" field is "0" for every asset and is a red herring — the real numbers
    live under "balances". A zero balance may drop the asset from the list entirely, so absence
    is reported as zeros rather than an error.
    """
    for owned in assets.get("owned_assets", []):
        identifier = owned.get("priced_asset", {}).get("asset_info", {}).get("asset_identifier", {})
        details = identifier.get("details", {})
        if details.get("type") != "erc20":
            continue
        if (details.get("token", {}).get("hex_repr") or "").lower() != USDT.lower():
            continue
        balances = owned.get("balances", {})
        return {
            "total_mined": int(balances.get("total_mined", 0)),
            "available_mined": int(balances.get("available_mined", 0)),
            "total_pending_incoming": int(balances.get("total_pending_incoming", 0)),
            "present": True,
        }
    return {"total_mined": 0, "available_mined": 0, "total_pending_incoming": 0, "present": False}


def fetch_tx(tx_id: str) -> dict:
    resp = requests.get(
        f"{BASE_URL}/api/v1/transactions/{tx_id}", headers=_auth_headers(), timeout=30
    )
    resp.raise_for_status()
    return resp.json()


async def submit_transfer(call_data: str) -> str:
    request_json = build_request(call_data)
    request_body = json.dumps(request_json)
    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
    payload = f"{CREATE_TX_PATH}|{timestamp}|{request_body}"
    signature = await sign_with_api_user_private_key(
        payload=payload, api_user_private_key=API_USER_PRIVATE_KEY
    )
    resp = await broadcast_tx(CREATE_TX_PATH, USER_API_TOKEN, signature, timestamp, request_body)
    return resp.json()["id"]


# ─────────────────────────────── observers ───────────────────────────────

class Timeline:
    """Every observation on one monotonic clock, t=0 at submission."""

    def __init__(self):
        self.t0 = time.monotonic()
        self.events: list[tuple[float, str, str]] = []

    def mark(self, source: str, message: str) -> float:
        elapsed = time.monotonic() - self.t0
        self.events.append((elapsed, source, message))
        print(f"  [+{elapsed:6.2f}s] {source:<9} {message}", flush=True)
        return elapsed

    def first(self, source: str, needle: str) -> float | None:
        for elapsed, src, message in self.events:
            if src == source and needle in message:
                return elapsed
        return None


class RunState:
    """Shared state between the three concurrent observers."""

    def __init__(self):
        self.stop = asyncio.Event()        # all observers wind down
        self.approved = asyncio.Event()    # tx has left the policy-approval gate
        self.completed = asyncio.Event()   # tx reached "completed" — fires the triggered balance check
        self.tx: dict = {}                 # latest transaction object seen
        self.mined_at: float | None = None
        self.completed_at: float | None = None
        self.failed = False


async def poll_tx_state(tx_id: str, timeline: Timeline, state: "RunState") -> None:
    """Primary source of truth for the settlement timestamp; also unblocks the approval gate."""
    seen: set[str] = set()
    while not state.stop.is_set():
        try:
            tx = await asyncio.to_thread(fetch_tx, tx_id)
        except Exception as exc:
            timeline.mark("tx", f"poll error: {exc}")
            await asyncio.sleep(TX_POLL_S)
            continue

        state.tx = tx
        tx_state = tx.get("state", "unknown")
        if tx_state not in seen:
            seen.add(tx_state)
            timeline.mark("tx", f"state → {tx_state}")

        # Once the tx is no longer parked on a policy decision, the measurement clock is meaningful.
        if tx_state not in PENDING_APPROVAL_STATES and not state.approved.is_set():
            state.approved.set()

        if tx_state == MINED_STATE and state.mined_at is None:
            state.mined_at = time.monotonic() - timeline.t0

        if tx_state == ANCHOR_STATE and state.completed_at is None:
            state.completed_at = time.monotonic() - timeline.t0
            state.completed.set()

        if tx_state in FAILURE_STATES:
            state.failed = True
            state.stop.set()
            return

        await asyncio.sleep(TX_POLL_S)


async def watch_webhooks(tx_id: str, before: set[str], timeline: Timeline, state: RunState) -> None:
    """Tail the running webhook server's log directory — no server restart needed.

    The delivery is an envelope {webhook_id, event_id, event: {...}, event_type}, so the transaction
    state lives at payload["event"]["state"], not at the top level. The full transition history is at
    payload["event"]["state_changes"], each entry carrying new_state + changed_at.

    This is the fastest signal available — webhooks arrive sub-second, ahead of a 1s poll — so a
    "completed" delivery here is what fires the triggered balance check.
    """
    seen_files = set(before)
    seen_states: set[str] = set()
    while not state.stop.is_set():
        try:
            current = {p.name for p in WEBHOOK_LOG_DIR.glob("*.json")}
        except OSError:
            current = set()
        for name in sorted(current - seen_files):
            seen_files.add(name)
            try:
                payload = json.loads((WEBHOOK_LOG_DIR / name).read_text())
            except (OSError, json.JSONDecodeError):
                continue
            event = payload.get("event", payload)
            if event.get("id") != tx_id:
                continue
            tx_state = event.get("state", "unknown")
            if tx_state in seen_states:
                continue
            seen_states.add(tx_state)
            timeline.mark("webhook", f"state → {tx_state} (sent_at {payload.get('sent_at', 'n/a')})")

            if tx_state == ANCHOR_STATE and state.completed_at is None:
                state.completed_at = time.monotonic() - timeline.t0
                state.completed.set()
        await asyncio.sleep(WEBHOOK_POLL_S)


async def triggered_balance_check(baseline: dict, timeline: Timeline, state: RunState) -> dict:
    """The query.md protocol: wait for the COMPLETED webhook, then immediately GET /assets.

    Reports whether that single immediate call already reflects the new balance — which is what a
    caller following "wait for the webhook, then read the balance" would actually observe.
    """
    await state.completed.wait()
    if state.completed_at is None:
        # Woken by shutdown, not by a real "completed" — there is nothing to trigger off.
        return {"fired_at": None, "reflected": None, "observed": None, "rtt": None,
                "skipped": "no 'completed' state observed"}
    fired_at = timeline.mark("trigger", f"'{ANCHOR_STATE}' seen → immediate /assets GET")
    try:
        observed = extract_usdt(await asyncio.to_thread(fetch_assets))
    except Exception as exc:
        timeline.mark("trigger", f"GET failed: {exc}")
        return {"fired_at": fired_at, "reflected": None, "observed": None, "rtt": None}

    rtt = (time.monotonic() - timeline.t0) - fired_at
    reflected = observed["total_mined"] == baseline["total_mined"] - AMOUNT
    timeline.mark(
        "trigger",
        f"GET returned total_mined={observed['total_mined']} after {rtt:.2f}s → "
        f"{'REFLECTED' if reflected else 'STALE'}",
    )
    return {"fired_at": fired_at, "reflected": reflected, "observed": observed, "rtt": rtt}


async def poll_assets(baseline: dict, timeline: Timeline, state: RunState) -> dict:
    """Poll the benchmarked endpoint until its answer changes, then a little longer.

    Polls from submission onward, so an update that lands *before* the settlement state is still
    caught rather than being misattributed as instant.
    """
    watched = ("total_mined", "available_mined", "total_pending_incoming")
    changed_at: float | None = None
    observations: list[tuple[float, dict]] = []
    previous = baseline  # compare against the last observation so a steady value isn't re-logged

    while True:
        if changed_at is None and state.stop.is_set():
            break
        if changed_at is not None and (time.monotonic() - timeline.t0) > changed_at + SETTLE_TAIL_S:
            break

        try:
            current = extract_usdt(await asyncio.to_thread(fetch_assets))
        except Exception as exc:
            timeline.mark("assets", f"poll error: {exc}")
            await asyncio.sleep(ASSETS_POLL_S)
            continue

        moved = [k for k in watched if current[k] != previous[k]]
        if moved:
            elapsed = timeline.mark(
                "assets",
                "changed: " + ", ".join(f"{k} {previous[k]}→{current[k]}" for k in moved),
            )
            if changed_at is None:
                changed_at = elapsed
            observations.append((elapsed, current))
            previous = current
        await asyncio.sleep(ASSETS_POLL_S)

    return {
        "changed_at": changed_at,
        "final": observations[-1][1] if observations else baseline,
        "observations": observations,
    }


# ─────────────────────────────── one benchmark run ───────────────────────────────

async def run_once(run_index: int, total_runs: int) -> dict | None:
    print(f"\n{'='*78}\nRUN {run_index}/{total_runs}\n{'='*78}")

    baseline = extract_usdt(await asyncio.to_thread(fetch_assets))
    print(
        f"Baseline USD₮: {baseline['total_mined']} units "
        f"({baseline['total_mined'] / 10**DECIMALS:.6f} USD₮), "
        f"pending_incoming {baseline['total_pending_incoming']}"
    )
    if not baseline["present"]:
        print("❌ USD₮ is not in the source vault's Kaia assets — nothing to move.")
        return None
    if baseline["available_mined"] < AMOUNT:
        print(f"❌ Insufficient USD₮: need {AMOUNT}, have {baseline['available_mined']}.")
        return None

    webhook_files_before = (
        {p.name for p in WEBHOOK_LOG_DIR.glob("*.json")} if WEBHOOK_LOG_DIR.is_dir() else set()
    )
    if not WEBHOOK_LOG_DIR.is_dir():
        print(f"⚠️  Webhook log dir not found at {WEBHOOK_LOG_DIR} — webhook timing unavailable.")

    call_data = build_call_data()
    tx_id = await submit_transfer(call_data)

    timeline = Timeline()
    timeline.mark("submit", f"tx id {tx_id}")

    state = RunState()
    tx_task = asyncio.create_task(poll_tx_state(tx_id, timeline, state))
    assets_task = asyncio.create_task(poll_assets(baseline, timeline, state))
    webhook_task = asyncio.create_task(watch_webhooks(tx_id, webhook_files_before, timeline, state))
    trigger_task = asyncio.create_task(triggered_balance_check(baseline, timeline, state))

    # Phase 1 — wait out any policy approval gate. This is dead time, not latency.
    try:
        await asyncio.wait_for(state.approved.wait(), timeout=APPROVAL_TIMEOUT_S)
    except asyncio.TimeoutError:
        timeline.mark("tx", f"still awaiting approval after {APPROVAL_TIMEOUT_S}s — giving up")
    approval_gate_at = timeline.mark("phase", "approval gate cleared; measuring from here")

    # Phase 2 — run until the tx is "completed" AND the endpoint has moved. Waiting for "completed"
    # is the point: it arrives ~60-90s after "mined" on Kaia, and the continuous assets poll keeps
    # running throughout, so an update that lands at "mined" is still timestamped correctly.
    async def until_done():
        while not state.stop.is_set():
            if state.failed:
                return
            if state.completed.is_set():
                break
            await asyncio.sleep(0.25)
        # "completed" is in; give the endpoint a bounded grace period to catch up rather than
        # spinning out the whole measurement window when it never moves.
        deadline = time.monotonic() + POST_COMPLETED_GRACE_S
        while not state.stop.is_set() and time.monotonic() < deadline:
            if assets_task.done():
                return
            await asyncio.sleep(0.25)

    try:
        await asyncio.wait_for(until_done(), timeout=MEASURE_TIMEOUT_S)
    except asyncio.TimeoutError:
        timeline.mark("phase", f"measurement window expired after {MEASURE_TIMEOUT_S}s")

    state.stop.set()
    state.completed.set()  # unblock the triggered check if "completed" never arrived
    try:
        trigger_result = await asyncio.wait_for(trigger_task, timeout=60)
    except asyncio.TimeoutError:
        trigger_result = {"fired_at": None, "reflected": None, "observed": None, "rtt": None}
    try:
        assets_result = await asyncio.wait_for(assets_task, timeout=SETTLE_TAIL_S + 60)
    except asyncio.TimeoutError:
        assets_result = {"changed_at": None, "final": baseline, "observations": []}
    tx_task.cancel()
    webhook_task.cancel()

    # Re-read the tx once at the end so state_changes reflects the final server-side truth.
    try:
        tx_final = await asyncio.to_thread(fetch_tx, tx_id)
    except Exception:
        tx_final = state.tx

    return report(run_index, baseline, tx_id, tx_final, timeline, assets_result,
                  state, approval_gate_at, trigger_result)


def report(run_index, baseline, tx_id, tx_final, timeline, assets_result,
           run_state, approval_gate_at, trigger_result) -> dict:
    print(f"\n── RUN {run_index} RESULT ──")

    state = tx_final.get("state", "unknown")
    tx_hash = tx_final.get("hash") or tx_final.get("transaction_hash")
    print(f"tx {tx_id}  final state: {state}")
    if tx_hash:
        print(f"on-chain: https://kaiascan.io/tx/{tx_hash}")

    # Server-authoritative timestamps for each state transition.
    server_times = {
        c.get("new_state"): c.get("changed_at")
        for c in (tx_final.get("state_changes") or [])
    }

    webhook_mined = timeline.first("webhook", f"state → {MINED_STATE}")
    tx_mined = timeline.first("tx", f"state → {MINED_STATE}")
    webhook_completed = timeline.first("webhook", f"state → {ANCHOR_STATE}")
    tx_completed = timeline.first("tx", f"state → {ANCHOR_STATE}")
    assets_changed = assets_result["changed_at"]

    def fmt(v):
        return f"+{v:.2f}s" if v is not None else "not observed"

    print(f"\napproval gate cleared (dead time, excluded)     +{approval_gate_at:.2f}s")
    print(f"tx {MINED_STATE:<9} webhook {fmt(webhook_mined):>12}   API {fmt(tx_mined):>12}   "
          f"server {server_times.get(MINED_STATE, 'n/a')}")
    print(f"tx {ANCHOR_STATE:<9} webhook {fmt(webhook_completed):>12}   API {fmt(tx_completed):>12}   "
          f"server {server_times.get(ANCHOR_STATE, 'n/a')}")
    if webhook_mined is not None and webhook_completed is not None:
        print(f"   └─ {MINED_STATE} → {ANCHOR_STATE} gap: {webhook_completed - webhook_mined:+.2f}s")
    print(f"/assets reflects new balance                    "
          f"{fmt(assets_changed) if assets_changed is not None else 'NEVER (within timeout)'}")

    # Latency against BOTH anchors: "mined" (in a block) and "completed" (Fordefi calls it final).
    latency_vs_webhook = None    # vs completed webhook — the query.md protocol's reference point
    latency_vs_api = None        # vs completed, API-observed
    latency_vs_mined = None
    if assets_changed is not None:
        if webhook_completed is not None:
            latency_vs_webhook = assets_changed - webhook_completed
            print(f"  ─ vs {ANCHOR_STATE} webhook receipt              {latency_vs_webhook:+.2f}s")
        if tx_completed is not None:
            latency_vs_api = assets_changed - tx_completed
            print(f"  ─ vs {ANCHOR_STATE} API-observed                 {latency_vs_api:+.2f}s")
        if webhook_mined is not None:
            latency_vs_mined = assets_changed - webhook_mined
            print(f"  ─ vs {MINED_STATE} webhook receipt (for contrast) {latency_vs_mined:+.2f}s")

    # The query.md protocol verbatim: COMPLETED webhook arrives → one immediate GET.
    print(f"\ntriggered check on '{ANCHOR_STATE}' webhook → immediate GET:")
    if trigger_result.get("skipped"):
        print(f"  skipped — {trigger_result['skipped']}")
    elif trigger_result.get("reflected") is None:
        print("  GET failed")
    else:
        print(f"  fired at +{trigger_result['fired_at']:.2f}s, GET took {trigger_result['rtt']:.2f}s → "
              f"{'✅ balance already REFLECTED' if trigger_result['reflected'] else '❌ still STALE'}")
        print(f"  returned total_mined={trigger_result['observed']['total_mined']} "
              f"(expected {baseline['total_mined'] - AMOUNT})")

    if webhook_completed is None:
        print(
            "\n⚠️  No '" + ANCHOR_STATE + "' webhook for this tx landed in live_logs/fordefi/. Check the\n"
            "    receiver on :8080, that ngrok's URL still matches the 'Kaia Test' webhook, and that\n"
            "    Fordefi's egress IP is in ALLOWED_IPS (webhooks_fordefi.ts:17) — a 403 writes no file.\n"
            "    The API-poll timestamps above are unaffected."
        )

    # Accuracy: the delta must be exactly -AMOUNT.
    final = assets_result["final"]
    delta = final["total_mined"] - baseline["total_mined"]
    accurate = delta == -AMOUNT
    print(
        f"\nold balance {baseline['total_mined']} → new {final['total_mined']}  "
        f"(delta {delta:+d}, expected {-AMOUNT:+d}) "
        f"{'✅' if accurate else '❌ MISMATCH'}"
    )
    if final["total_pending_incoming"]:
        print(f"⚠️  total_pending_incoming has not settled: {final['total_pending_incoming']}")
    if state not in (ANCHOR_STATE, MINED_STATE):
        print(f"⚠️  Transaction did not settle (state {state}) — latency figures are not meaningful.")

    return {
        "run": run_index,
        "tx_id": tx_id,
        "state": state,
        "tx_hash": tx_hash,
        "assets_changed_at": assets_changed,
        "tx_mined_at": tx_mined,
        "webhook_mined_at": webhook_mined,
        "tx_completed_at": tx_completed,
        "webhook_completed_at": webhook_completed,
        "server_mined_at": server_times.get(MINED_STATE),
        "server_completed_at": server_times.get(ANCHOR_STATE),
        "approval_gate_at": approval_gate_at,
        "latency_vs_webhook": latency_vs_webhook,
        "latency_vs_api": latency_vs_api,
        "latency_vs_mined": latency_vs_mined,
        "triggered_reflected": trigger_result.get("reflected"),
        "triggered_rtt": trigger_result.get("rtt"),
        "delta": delta,
        "accurate": accurate,
    }


def summarize(results: list[dict]) -> None:
    usable = [r for r in results if r and r["assets_changed_at"] is not None]
    print(f"\n{'='*78}\nSUMMARY ({len(usable)}/{len(results)} runs usable)\n{'='*78}")
    if not usable:
        print("No usable samples.")
        return
    for key, label in (("latency_vs_webhook", f"vs {ANCHOR_STATE} webhook"),
                       ("latency_vs_api", f"vs {ANCHOR_STATE} API-observed"),
                       ("latency_vs_mined", f"vs {MINED_STATE} webhook")):
        samples = sorted(r[key] for r in usable if r[key] is not None)
        if not samples:
            print(f"{label:<28} no samples")
            continue
        mid = len(samples) // 2
        median = samples[mid] if len(samples) % 2 else (samples[mid - 1] + samples[mid]) / 2
        print(f"{label:<28} min {samples[0]:+.2f}s  median {median:+.2f}s  "
              f"max {samples[-1]:+.2f}s  (n={len(samples)})")
        # This endpoint has a heavy tail: most samples land ~1s but some take tens of seconds.
        # A median alone hides that, so every sample is printed.
        print(f"{'':<28} samples: " + ", ".join(f"{s:+.2f}" for s in samples))
    reflected = [r for r in usable if r["triggered_reflected"] is not None]
    if reflected:
        hits = sum(1 for r in reflected if r["triggered_reflected"])
        print(f"triggered check on '{ANCHOR_STATE}': {hits}/{len(reflected)} already reflected the "
              f"new balance on the first immediate GET")
    print(f"accuracy: {sum(1 for r in usable if r['accurate'])}/{len(usable)} runs matched exactly")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print the payload and exit, spend nothing")
    parser.add_argument("--runs", type=int, default=1, help="number of benchmark runs (default 1)")
    args = parser.parse_args()

    call_data = build_call_data()

    if args.dry_run:
        request_json = build_request(call_data)
        print("── DRY RUN — nothing submitted ──")
        print(json.dumps(request_json, indent=2))
        print("\nDecoded call data:")
        print(f"  selector   0xa9059cbb  transfer(address,uint256)")
        print(f"  recipient  0x{call_data[34:74]}")
        print(f"  amount     {int(call_data[74:], 16)} units = "
              f"{int(call_data[74:], 16) / 10**DECIMALS:.6f} USD₮")
        print(f"  to         {USDT}  (USD₮ on Kaia)")
        print(f"  from vault {SOURCE_VAULT_ID}")
        print(f"  custom_nonce present: {'custom_nonce' in json.dumps(request_json)}")
        baseline = extract_usdt(await asyncio.to_thread(fetch_assets))
        print(f"\nCurrent USD₮ balance: {baseline['total_mined']} units "
              f"({baseline['total_mined'] / 10**DECIMALS:.6f} USD₮)")
        return

    results = []
    for i in range(1, args.runs + 1):
        try:
            results.append(await run_once(i, args.runs))
        except Exception as exc:
            print(f"❌ Run {i} failed: {exc}")
            results.append(None)
        if i < args.runs:
            await asyncio.sleep(5)

    if args.runs > 1:
        summarize(results)


if __name__ == "__main__":
    asyncio.run(main())
