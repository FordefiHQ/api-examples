# Stellar Raw Transaction via Fordefi

Build an unsigned Stellar transaction locally with `@stellar/stellar-sdk`, then submit the base64 XDR to [Fordefi](https://docs.fordefi.com/developers/program-overview) via the `stellar_raw_transaction` API for MPC signing and broadcast.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
   Set `FORDEFI_API_USER_TOKEN`, `FORDEFI_STELLAR_VAULT_ID`, `STELLAR_VAULT_ADDRESS`, `STELLAR_DESTINATION`, `STELLAR_AMOUNT`.

3. Set up an API Signer and pair your API User with it ([docs](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)).

4. Place your API User private key at `../fordefi/secret/private.pem` (shared by all four Stellar examples).

5. Make sure your API Signer is running.

## Usage

```bash
npm run raw
```

The script:
1. Loads the source account's sequence number from Horizon (`https://horizon.stellar.org`)
2. Builds an unsigned native XLM payment with `TransactionBuilder` and serializes it to base64 XDR
3. Submits a `stellar_raw_transaction` request to Fordefi
4. Polls until terminal state and prints the Stellar transaction hash and explorer URL

## How It Works

The example demonstrates the general-purpose pattern for `stellar_raw_transaction`: build any operation graph locally (payment, path payment, manage offer, manage data, account merge, Soroban invoke, etc.), serialize the transaction envelope to XDR, and let Fordefi handle MPC signing and broadcast. To build a different operation, replace the `Operation.payment(...)` call in `src/run.ts` with the operation(s) you need — the rest of the flow stays the same.
