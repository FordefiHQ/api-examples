# SPL Token Transfer with Solana Gill Library

This example demonstrates how to perform SPL token transfers on Solana using the Gill library and Fordefi's API.

## Prerequisites

- **Fordefi Setup:**
  - Fordefi organization and Solana vault
  - API User access token
  - API User private key (PEM format)
  - API Signer configured ([documentation](https://docs.fordefi.com/developers/program-overview))

- **Development Environment:**
  - Node.js and npm installed
  - TypeScript setup:
    ```bash
    # Install dependencies
    npm install
    
    # Install TypeScript globally (if not already installed)
    npm install -g typescript
    ```

## Configuration

1. **Environment Variables:**
   Create a `.env` file in the project root:
   ```env
   FORDEFI_API_TOKEN=your_api_token_here
   ORIGIN_VAULT=your_origin_vault_id
   ORIGIN_ADDRESS=your_source_wallet_address
   DESTINATION_ADDRESS=recipient_wallet_address
   ```

2. **Private Key:**
   Place your API User's private key in `./secret/private.pem`

3. **Transfer Settings:**
   Modify `src/config.ts` to adjust:
   - Token mint address (default: USDC)
   - Transfer amount
   - RPC endpoint

## Usage

Run the SPL token transfer:

```bash
npm run spl
```

## How It Works

1. **Transaction Building:** Uses Gill library to construct a token transfer transaction
2. **Serialization:** Converts the transaction to base64-encoded bytes
3. **API Signing:** Signs the payload with your API User private key
4. **MPC Signature:** Submits to Fordefi for MPC signing
5. **Network Submission:** Automatically broadcasts the signed transaction to Solana

## Key Components

- `serialize-spl-transfer.ts`: Builds the token transfer transaction using Gill
- `signer.ts`: Handles API payload signing
- `process_tx.ts`: Manages API communication with Fordefi
- `config.ts`: Configuration and environment variable management
