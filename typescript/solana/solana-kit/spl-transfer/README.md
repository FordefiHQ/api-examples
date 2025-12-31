# SPL Token Transfer with Fordefi + Solana Kit

Transfer SPL tokens using [Fordefi](https://fordefi.com) and the [Solana Kit](https://www.solanakit.com/) library.

## Prerequisites

1. **Fordefi API Setup**: Complete the [API Signer setup guide](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)

## Installation

```bash
npm install
```

## Configuration

1. Create a `.env` file:

```env
FORDEFI_API_TOKEN=your_api_token
ORIGIN_VAULT=your_solana_vault_id
ORIGIN_ADDRESS=your_solana_vault_address
DESTINATION_ADDRES=recipient_address
```

2. Place your API User private key at `./secret/private.pem`

3. Edit `src/config.ts` to configure the transfer:

```typescript
export const transferConfig: TransferConfig = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Token mint (USDC)
  decimals: 6,
  amount: 100,      // Amount in base units
  useJito: false,   // Optional: use Jito for MEV protection
};
```

## Usage

```bash
npm run spl
```
