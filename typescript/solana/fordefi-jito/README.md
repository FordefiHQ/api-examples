## Setup

1. Create a Fordefi API user and API Signer ([tutorial](https://docs.fordefi.com/reference/getting-started))
2. Clone this repository
3. Install TypeScript and ts-node globally:
   ```bash
   npm install -g typescript ts-node
   ```
4. Run `npm install` to install all the dependencies.
5. Create a `.env` file in the root directory with the following variables:
   ```
   FORDEFI_API_TOKEN=your_api_token
   VAULT_ID=your_solana_vault_id
   FORDEFI_SOLANA_ADDRESS=your_solana_vault_address
   QUICKNODE_MAINNET_KEY=your_rpc_access_token
   ```
6. Place your API Signer's `.pem` private key file in the `/secret` directory at the root of this project.
7. Create an empty `txs` directory at the root of this project.

## Configuration for Meteora operations:

Navigate to the `./meteora` folder, select a script and add your variables to the `TO CONFIGURE` section

## Example usage for a swap on Meteora

Execute the following scripts in order:

1. `npm run swap-meteora` - Prepares the serialized tx payload
2. `npm run create-tx` - Creates, signs and broadcast the transaction to Jito's Block Engine.

## Example usage for a swap on Jupiter

Execute the following scripts in order:

1. `npm run swap-jupiter` - Prepares the serialized tx payload
2. `npm run create-tx` - Creates, signs and broadcast the transaction to Jito's Block Engine.