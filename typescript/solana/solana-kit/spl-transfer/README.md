# SPL Token Transfer with Fordefi + Solana Kit

Transfer SPL tokens using [Fordefi](https://fordefi.com) and the [Solana Kit](https://www.solanakit.com/) library.

Signing goes through [`@solana/keychain-fordefi`](https://github.com/solana-foundation/solana-keychain/tree/main/typescript/packages/fordefi), a Kit signer for your Fordefi vault: it signs the API request with your API User key, submits the transaction to Fordefi, waits for the MPC signature and verifies it before handing it back to Kit.

## Prerequisites

1. **Fordefi API Setup**: Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)

## Installation

```bash
npm install
```

## Configuration

1. Credentials are shared by all solana-kit examples: put your API User private key at `solana-kit/secret/private.pem` and these variables in `solana-kit/.env` (see the [shared setup](../README.md)):

```env
FORDEFI_API_TOKEN=your_api_token
FORDEFI_VAULT_ID=your_solana_vault_id
FORDEFI_VAULT_ADDRESS=your_solana_vault_address
DESTINATION_ADDRESS=recipient_address
```

2. Edit `src/config.ts` to configure the transfer:

```typescript
export const transferConfig: TransferConfig = {
  mint: '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH', // Token mint (USDG, Token-2022)
  decimals: 6,
  amount: 10_000,   // Amount in base units (0.01 USDG)
  useJito: false,   // Optional: use Jito for MEV protection
};
```

The token program is read from the mint, so classic SPL Token mints (e.g. USDC) and Token-2022 mints (e.g. USDG) both work.

With `useJito: false` the signer runs in Fordefi's auto push mode, so Fordefi broadcasts the transaction. With `useJito: true` it runs in manual push mode: Fordefi signs without broadcasting and the script sends the signed transaction to Jito's block engine. Fordefi may refresh the blockhash and priority fee before signing, so the script always broadcasts the transaction Fordefi returns.

## Usage

```bash
npm run spl
```

## Testing

```bash
npm test
```

The tests run `src/run.ts` against a mock Fordefi API and a mock Solana RPC, both backed by [LiteSVM](https://github.com/LiteSVM/litesvm). No credentials or funds are needed and nothing is sent to the network. They check the requests the signer sends to Fordefi and that the signed transfer executes in both push modes.
