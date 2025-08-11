## EVM contract calls with a Fordefi vault

This example shows two ways to call EVM contracts using a Fordefi vault as the signer:

- **ABI method**: when you know the contract ABI (e.g., call `transfer`, `approve`, etc.)
- **Raw data method**: when you only have the target `to` address and calldata bytes

The code lives in this folder and uses `ethers` v6 with `@fordefi/web3-provider`.

### Prerequisites
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

### Install
```bash
npm install
```

### Configure
Edit `src/config.ts` and set:
- **`chainId`** and the fallback **`rpcUrl`** for the target network
- **`address`**: your Fordefi EVM vault address (the signer)
- **`CONTRACT_ADDRESS`**: the target contract
- **`DESTINATION_ADDRESS`**: recipient for sample transfers
- **`RAW_CALL_DATA`**: calldata for the raw example (hex string)
- **`DECIMALS`**: token decimals when formatting/parsing amounts

Set your Fordefi API token in the environment before running:
```bash
export FORDEFI_API_USER_TOKEN=YOUR_API_USER_TOKEN
```

Ensure your API user's signing key exists at `./fordefi_secret/private.pem`.

### Method 1: ABI-based calls
Use when you know the contract ABI. The example invokes `transfer` via `ethers.Contract` and the Fordefi signer.

Run:
```bash
npm run abi
```

What it does:
- Initializes a Fordefi Web3 provider
- Uses `ethers` to create a contract instance with a minimal ABI
- Calls `transfer(DESTINATION_ADDRESS, amount)` and waits for confirmation

You can extend the ABI array in `src/abi-call.ts` to add more functions (e.g., `approve`, `allowance`, etc.).

### Method 2: Raw calldata
Use when you only have the calldata and target contract (no ABI). The example sends a transaction with `to` and `data`.

Run:
```bash
npm run raw
```

What it does:
- Initializes a Fordefi Web3 provider and signer
- Sends a transaction to `CONTRACT_ADDRESS` with `RAW_CALL_DATA`
- Includes sample gas fields; you can omit them to let the network/provider estimate

### Notes
- Ensure the Fordefi vault has enough native gas for the target chain.
- To switch chains, update `chainId` and `rpcUrl` in `src/config.ts`.
- The provider is created via `@fordefi/web3-provider` and wrapped in `ethers.BrowserProvider` to use `ethers` v6 APIs.

### Useful files
- `src/config.ts`: all runtime configuration
- `src/abi-call.ts`: ABI-based example
- `src/raw-contract-call.ts`: raw calldata example
- `package.json` scripts: `abi`, `raw`


