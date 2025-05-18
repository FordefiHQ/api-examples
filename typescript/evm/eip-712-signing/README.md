# Message Signing with Fordefi

Helper code for signing arbitrary EIP-712 typed data with your Fordefi EVM vault

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- Fordefi credentials: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))
- TypeScript setup:
  ```bash
  # Install TypeScript and type definitions
  npm install typescript --save-dev
  npm install @types/node --save-dev
  npm install tsx --save-dev
  
  # Initialize a TypeScript configuration file (if not already done)
  npx tsc --init
  ```

## Setup

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3.Install your chosen version ethers:
```bash
npm install ethers@^6.x.x # for example 6.14.1
```
or 
```bash
npm install ethers@^5.x.x # for example 5.8.0
```
4. Create a `.env` file in the root directory with your Fordefi API user token:
```bash
FORDEFI_API_USER_TOKEN=your_api_user_token_here
```

4. Create a directory `fordefi_secret` and place your API Signer's PEM private key in `fordefi_secret/private.pem`

## Configuration

The script uses the following main configurations:

To modify parameters, update the `fordefiConfig` object in `config.ts`:

```typescript
export const fordefiConfig: FordefiProviderConfig = {
    chainId: EvmChainId.NUMBER_8453, // Base
    address: '0x1234', // The Fordefi EVM Vault that will sign the message
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), // your Fordefi API User Access Token 
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(), // your Fordefi API User Private Key 
    rpcUrl: 'https://base.llamarpc.com', // RPC endpoint for chosen network
  };
```

## Usage

To sign a message while using `ethers@^5.x.x`
```bash
npm run sign-v5
```
To sign a message while using `ethers@^6.x.x`
```bash
npm run sign-v6
```

