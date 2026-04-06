# Starknet Contract Calls via Fordefi

General-purpose Starknet contract invocation using [Fordefi](https://docs.fordefi.com/developers/program-overview) as the remote MPC signer.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
   Set `FORDEFI_API_USER_TOKEN` and `FORDEFI_STARKNET_VAULT_ID`.

3. Setup an API Signer and pair your API User with your API Signer, learm more [here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker).

4. Place your API User private key at `./secret/private.pem`.

5. Make sure your API Signer is up and running.

## Usage

Edit `src/config.ts` with your contract call details:

```ts
export const contractCallConfig: ContractCallConfig = {
  contractAddress: "0x....",
  methodName: "register_operator",
  methodArguments: ["0x05e0cce9382de6b18051f014f9078df73af85bcddb7ef158743cca7c484f5997"],
};
```

Then run:

```bash
npm run call
```

The script submits an INVOKE transaction via the Fordefi API, polls until it's mined, and prints the transaction hash with a Voyager link.

## How It Works

1. Builds a `starknet_contract_call` request from your config
2. Signs the API payload with your RSA private key
3. POSTs to `https://api.fordefi.com/api/v1/transactions`
4. Fordefi performs MPC signing and broadcasts to Starknet
5. Polls until the transaction reaches a terminal state
