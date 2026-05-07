# Stellar Sign Message via Fordefi

Sign an arbitrary Stellar message using [Fordefi](https://docs.fordefi.com/developers/program-overview) as the remote MPC signer. This is the `stellar_message` request type — it does not broadcast anything on-chain; it returns the signature(s) over your message.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
   Set `FORDEFI_API_USER_TOKEN`, `FORDEFI_STELLAR_VAULT_ID`, and either:
   - `STELLAR_MESSAGE` — plain UTF-8 text (the script hex-encodes it before sending) OR
   - `STELLAR_MESSAGE_HEX` — pre-built `0x...` hex string (takes precedence).

   Optionally set `STELLAR_DAPP_NAME` + `STELLAR_DAPP_URL` to attach `dapp_info`.

3. Set up an API Signer and pair your API User with it ([docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)).

4. Place your API User private key at `../fordefi/secret/private.pem` (shared by all four Stellar examples).

5. Make sure your API Signer is running.

## Usage

```bash
npm run sign
```

The script submits a `stellar_message` request via the Fordefi API, polls until it reaches a terminal state, and prints the signature(s).

## How It Works

1. Builds a `CreateStellarMessageRequest` with `details.raw_data` set to a `0x`-prefixed hex string (per the Fordefi schema's `^0[xX][a-fA-F0-9]+$` pattern)
2. Signs the API payload with your RSA private key
3. POSTs to `https://api.fordefi.com/api/v1/transactions`
4. Fordefi performs MPC signing of the message
5. Polls until the message reaches a terminal state (`signed` / `completed`) and prints the base64 signature(s)
