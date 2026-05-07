# Stellar ClaimClaimableBalance via Fordefi

Claim Stellar claimable balances using [Fordefi](https://docs.fordefi.com/developers/program-overview) as the remote MPC signer. The Fordefi API auto-creates a trustline first if needed.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
   Set `FORDEFI_API_USER_TOKEN`, `FORDEFI_STELLAR_VAULT_ID`, plus either:
   - `STELLAR_ASSET_CODE` + `STELLAR_ASSET_ISSUER` for `by_asset` mode (default), or
   - `STELLAR_INCOMING_TX_ID` for `by_transaction` mode (uncomment the alternate branch in `src/run.ts`).

3. Set up an API Signer and pair your API User with it ([docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)).

4. Place your API User private key at `../fordefi/secret/private.pem` (shared by all four Stellar examples).

5. Make sure your API Signer is running.

## Usage

```bash
npm run claim
```

## How It Works

1. Builds a `stellar_claim_claimable_balance` request. Two source modes:
   - `by_asset` — claim all claimable balances of a given native or classic asset.
   - `by_transaction` — claim balances tied to a specific Fordefi incoming-transaction UUID.
2. Signs the API payload with your RSA private key
3. POSTs to `https://api.fordefi.com/api/v1/transactions`
4. Fordefi performs MPC signing, auto-creates a trustline if required, and broadcasts the claim
5. Polls until the transaction reaches a terminal state
