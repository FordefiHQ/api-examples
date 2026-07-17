# Canton examples

Example scripts for using a Fordefi Canton vault on `canton_mainnet` via the Fordefi API.

## Scripts

| Script | What it does |
|---|---|
| `activate_vault_canton.py` | Activates the vault by allocating its external party on a Canton node (`canton_party_allocation`). Run this once before anything else. |
| `approve_native_canton.py` | Sets up transfer pre-approval for native CC (`canton_pre_approval_setup`), so incoming CC deposits are auto-accepted. |
| `approve_deposit_canton.py` | Manually approves a specific incoming deposit by its Fordefi transaction id (`canton_approve_transfer`). Use this instead of (or before setting up) pre-approval. |
| `transfer_native_canton.py` | Transfers native CC to a Canton party id (`canton_transfer`). |

Typical onboarding order: **activate** → **approve native CC** (or approve deposits manually) → **transfer**.

## Setup

Follow the setup steps in the [parent README](../README.md) (uv, API Signer, `secret/private.pem`), and add your Canton vault id to the `.env` file at the root of `simple-api-transfers`:

```plaintext
FORDEFI_API_TOKEN="your_api_user_token"
CANTON_VAULT_ID="your_canton_vault_id"
```

## Usage

Edit the `## Fordefi configuration` section of the script (destination party id, amount, note), then run from the `simple-api-transfers` directory:

```bash
uv run python canton/<script_name>.py
```

For deposit approval, the transaction id can also be passed as a CLI argument:

```bash
uv run python canton/approve_deposit_canton.py <fordefi_transaction_id>
```

## Notes

- Amounts are decimal strings in smallest units; CC (Canton Coin) has **10 decimals**, so 1 CC = `10_000_000_000` units.
- Recipient addresses are Canton party ids, e.g. `a40499fb...::1220658f...`.
