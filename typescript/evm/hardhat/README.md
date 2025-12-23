# Using Fordefi with Hardhat Local Development

This project shows how to use your Fordefi EVM vault to sign transactions on a local Hardhat node. This setup allows you to test contract deployments and interactions using Fordefi's MPC signing before deploying to production networks.

## Prerequisites

- A Fordefi EVM vault
- Fordefi API user token
- API User private key (PEM file)
- Fordefi API Signer setup and running [see here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
- Node.js and npm installed

## Setup

### 1. Configure Environment Variables

Create a `.env` file with your Fordefi credentials:

```shell
FORDEFI_API_USER_TOKEN=your_api_token
FORDEFI_EVM_VAULT_ID=your_vault_id
FORDEFI_EVM_VAULT_ADDRESS=your_vault_address
```

Place your API user private key at `./fordefi_secret/private.pem`.

### 2. Add Hardhat as a Custom Chain

Since Hardhat runs locally, you need to expose it via a tunnel and add it as a custom chain in Fordefi.

1. Start ngrok to expose your local node:

```shell
ngrok http 8545
```

2. In the Fordefi web console, add a custom chain:
   - Chain ID: `31337`
   - RPC URL: Your ngrok URL (e.g., `https://abc123.ngrok.io`)

See [Add Custom Chain](https://docs.fordefi.com/user-guide/manage-chains/add-custom-chain) for detailed instructions.

## Workflow

### 1. Start Your Hardhat Node

```shell
npx hardhat node
```

### 2. Fund Your Vault

Transfer test ETH from a Hardhat account to your Fordefi vault:

```typescript
const sender = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat account #0
const recipient = "YOUR_FORDEFI_VAULT_ADDRESS";

const tx = await provider.send("eth_sendTransaction", [{
  from: sender,
  to: recipient,
  value: "0x56BC75E2D63100000" // 100 ETH
}]);
```

### 3. Deploy Your Contract

```shell
npx hardhat ignition deploy ignition/modules/YourContract.ts --network localhost
```

### 4. Configure the Transaction

In your config file, set:

```typescript
export const txParams = {
  evmChain: "31337",
  to: "YOUR_CONTRACT_ADDRESS",
  amount: "0",
  gas_limit: "50000",
  max_fee_per_gas: "1000000000",
  max_priority_fee_per_gas: "1000000000",
};

export const contractAbi = [
  "function yourFunction(uint256 param)",
];
```

### 5. Send the Transaction

The transaction flow:

1. Encode call data using ethers
2. Sign the API payload with your private key
3. Submit to Fordefi API for MPC signing
4. Poll for the transaction hash
5. Confirm on the local Hardhat node

```typescript
// Encode the function call
const callData = encodeCallData(contractAbi, "yourFunction", [123]);

// Submit to Fordefi
const response = await createAndSignTx(config, txParams, callData);
const txHash = await pollForTxHash(response.data.id, accessToken);

// Wait for confirmation on Hardhat
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const receipt = await provider.waitForTransaction(txHash);
```

## Troubleshooting

**Nonce mismatch:** If you restart the Hardhat node, Fordefi's cached nonce may be stale. Override it manually:

```typescript
export const txParams = {
  // ...
  custom_nonce: "0"
};
```

Check the expected nonce with:

```shell
cast nonce YOUR_VAULT_ADDRESS --rpc-url http://127.0.0.1:8545
```