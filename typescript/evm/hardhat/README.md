# Sample Hardhat 3 Beta Project (`mocha` and `ethers`)

This project showcases a Hardhat 3 Beta project using `mocha` for tests and the `ethers` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using `mocha` and ethers.js
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `mocha` tests:

```shell
npx hardhat test solidity
npx hardhat test mocha
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```

## Using Fordefi as Signer

This project supports using [Fordefi](https://fordefi.com) as the transaction signer for interacting with contracts on your local Hardhat network via the Fordefi API.

### Setup

1. **Set environment variables** in `.env`:

```shell
FORDEFI_API_USER_TOKEN=your_api_token
FORDEFI_EVM_VAULT_ID=your_vault_id
FORDEFI_EVM_VAULT_ADDRESS=your_vault_address
```

2. **Place your API User private key** (used to sign payloads) at `./fordefi_secret/private.pem`

3. **Add Hardhat as a custom chain in Fordefi:**
   - Follow the guide: https://docs.fordefi.com/user-guide/manage-chains/add-custom-chain
   - Use chainID `31337`
   - Use the RPC URL from ngrok (see below)

4. **Expose your local Hardhat node via ngrok:**

```shell
ngrok http 8545
```

### Workflow

1. **Start your local Hardhat node:**

```shell
npx hardhat node
```

2. **Airdrop ETH to your Fordefi vault:**

```shell
npm run airdrop
```

This sends 100 ETH from a Hardhat test account to your Fordefi vault.

3. **Deploy the Counter contract:**

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts --network localhost
```

4. **Configure the transaction** in `fordefi-scripts/config.ts`:
   - Set `txParams.to` to the deployed contract address
   - Update `contractAbi` with the function signatures you want to call

5. **Call the contract using Fordefi:**

```shell
npm run call
```

This will:

- Encode the call data using ethers
- Sign and submit the transaction to Fordefi
- Poll the Fordefi API for the transaction hash
- Track confirmation on the local Hardhat node

### Troubleshooting

**Nonce mismatch:** If the Hardhat node and Fordefi get out of sync (e.g., after restarting the node), you may see nonce errors. To fix this, set `custom_nonce` in `fordefi-scripts/config.ts` to override the nonce manually. You can check the expected nonce by querying the Hardhat node or viewing the error message from Fordefi.
