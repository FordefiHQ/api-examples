# Stellar ChangeTrust via Fordefi

Establish a trustline for a Stellar classic asset (e.g. USDC) using [Fordefi](https://docs.fordefi.com/developers/program-overview) as the remote MPC signer.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
   Set `FORDEFI_API_USER_TOKEN`, `FORDEFI_STELLAR_VAULT_ID`, `STELLAR_ASSET_CODE`, `STELLAR_ASSET_ISSUER`.

3. Set up an API Signer and pair your API User with it ([docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)).

4. Place your API User private key at `../fordefi/secret/private.pem` (shared by all four Stellar examples).

5. Make sure your API Signer is running.

## Usage

```bash
npm run trust
```

The script submits a `stellar_change_trust` transaction via the Fordefi API, polls until terminal state, and prints the Stellar transaction hash with an explorer link.

## How It Works

1. Builds a `stellar_change_trust` request with a `classic_asset` identifier (code + issuer + chain)
2. Signs the API payload with your RSA private key
3. POSTs to `https://api.fordefi.com/api/v1/transactions`
4. Fordefi performs MPC signing and broadcasts the trustline operation to Stellar
5. Polls until the transaction reaches a terminal state
