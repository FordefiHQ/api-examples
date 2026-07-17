# Stellar examples

Example scripts for using a Fordefi Stellar vault on `stellar_mainnet` via the Fordefi API. Fordefi builds the transaction server-side, so no Stellar SDK is required.

## Scripts

| Script | What it does |
|---|---|
| `transfer_native_stellar.py` | Transfers native **XLM** to a Stellar address (`stellar_transfer`, `native` asset). |
| `transfer_token_stellar.py` | Transfers the **GYEN** classic asset — a JPY-pegged stablecoin — to a Stellar address (`stellar_transfer`, `classic_asset`). |

## Setup

Follow the setup steps in the [parent README](../README.md) (uv, API Signer, `secret/private.pem`), and add your Stellar vault id to the `.env` file at the root of `simple-api-transfers`:

```plaintext
FORDEFI_API_TOKEN="your_api_user_token"
STELLAR_VAULT_ID="your_stellar_vault_id"
```

## Usage

Edit the `## Fordefi configuration` section of the script (destination address, amount, note; for the token script also the asset code/issuer), then run from the `simple-api-transfers` directory:

```bash
uv run python stellar/transfer_native_stellar.py
uv run python stellar/transfer_token_stellar.py
```

## Notes

- Amounts are decimal strings in smallest units (stroops). Both XLM and Stellar classic assets use **7 decimals**, so 1 unit = `10_000_000` stroops.
- Recipient addresses are 56-character base32 strings starting with `G` (accounts) or `C` (Soroban contracts).
- **Trustline requirement:** to send or receive a classic asset like GYEN, both the sending vault and the destination account must have an established trustline for that asset (a `stellar_change_trust` operation). A transfer to an account without the trustline will fail. Establishing trustlines is out of scope for these simple transfer scripts.
- GYEN asset: code `GYEN`, issuer `GDF6VOEGRWLOZ64PQQGKD2IYWA22RLT37GJKS2EJXZHT2VLAGWLC5TOB` ([stellar.expert](https://stellar.expert/explorer/public/asset/GYEN-GDF6VOEGRWLOZ64PQQGKD2IYWA22RLT37GJKS2EJXZHT2VLAGWLC5TOB)).
- The only supported network id is `stellar_mainnet`.
