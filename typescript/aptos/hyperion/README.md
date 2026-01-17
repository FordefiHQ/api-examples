# Hyperion LP Withdrawal

This script withdraws liquidity from a Hyperion position on Aptos.

## Prerequisites

- Node.js (v16 or higher)
- Fordefi account with an Aptos vault
- Fordefi API User access token
- Fordefi API User private key (PEM format)
- Fordefi API Signer configured ([documentation](https://docs.fordefi.com/developers/program-overview))
- A **server** API key from [Geomi](https://geomi.dev/docs/api-keys)

## Setup

1. Create a `.env` file with the following variables:

   ```env
   FORDEFI_API_USER_TOKEN=<your-fordefi-api-token>
   GEOMI_API_KEY=<your-geomi-server-api-key>
   ```

2. Save your Fordefi API User private key to `./secret/private.pem`
3. Run `npm install`

## Usage

1. Get your position ID:
   ```bash
   npm run positions
   ```

2. Set `POSITION_ID` in `src/config.ts` to your position's `objectId` from the output:

   ```json
   {
     "position": {
       "objectId": "0x5048353d9f875957afe5a5117483e819b971ffd00e03f172e8d744b48248f46e",
       ...
     }
   }
   ```

3. Adjust `removeRatio` in `src/config.ts` (default: 1.0 = 100% withdrawal)

4. Run the withdrawal:
   ```bash
   npm run withdraw
   ```
