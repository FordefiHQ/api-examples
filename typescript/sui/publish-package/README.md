# Sui Package Publishing with Fordefi

This example demonstrates how to publish a Sui Move package to the Sui blockchain using Fordefi's API.

## Prerequisites

Before using this deployment script, you should have:

1. **Written your Move contract** - Your Sui Move package should be complete and ready for deployment
2. **Built your package** - You must have already run the following commands in your Move package directory:
   ```bash
   sui move build
   sui move build --dump-bytecode-as-base64 --path .
   ```
   These commands generate a JSON file containing:
   - `modules`: The compiled Move bytecode for each module in your package (base64-encoded)
   - `dependencies`: The package IDs of dependencies (Sui framework, Move stdlib, etc.)

3. **Fordefi API Access** - You need:
   - A Fordefi API user token
   - A Fordefi Sui vault
   - Your client private key file for API signing. [Click here to learn more.](https://docs.fordefi.com/developers/getting-started/pair-an-api-client-with-the-api-signer)

## Project Structure

```
publish-package/
├── deployer/                    # Deployment scripts and configuration
│   ├── deploy.ts               # Main deployment script
│   ├── configs.ts              # Configuration file
│   ├── serialize-tx.ts         # Transaction serialization for Fordefi
│   ├── package.json            # Dependencies and scripts
│   ├── fordefi_secret/         # Your private key files (gitignored)
│   └── api_utils/              # Fordefi API utilities
└── compiled-sui-package/        # Your compiled package JSON
    └── example-package.json    # Example of expected build output format
```

## Setup

### 1. Install Dependencies

Navigate to the `deployer` directory and install dependencies:

```bash
cd deployer
npm install
```

### 2. Prepare Your Compiled Package

1. Copy the JSON output from your `sui move build --dump-bytecode-as-base64 --path .` command
2. Save it as a JSON file in the `compiled-sui-package/` directory
3. Update the path in `configs.ts` to point to your JSON file

**Example compiled package format:**
```json
{
  "modules": [
    "oRzrCwYAAAAIAQ...base64-encoded-bytecode..."
  ],
  "dependencies": [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000002"
  ]
}
```

### 3. Configure Environment Variables

Create a `.env` file in the `deployer` directory with your Fordefi credentials:

```env
FORDEFI_API_USER_TOKEN=your_fordefi_api_token
VAULT_ID=your_sui_vault_id
VAULT_ADDRESS=your_sui_vault_address
```

### 4. Set Up Fordefi Private Key

1. Create a `fordefi_secret` directory in the `deployer` folder
2. Place your APi user private key file as `private.pem` in this directory. [Click here to learn more.](https://docs.fordefi.com/developers/getting-started/pair-an-api-client-with-the-api-signer)

```bash
mkdir fordefi_secret
# Copy your private.pem file to fordefi_secret/private.pem
```

### 5. Update Configuration

Edit `configs.ts` to match your setup:

```typescript
export const fordefiConfig: FordefiSolanaConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
    privateKeyPath: "./fordefi_secret/private.pem",
    vaultId: process.env.VAULT_ID || "",
    senderAddress: process.env.VAULT_ADDRESS || ""
};

// Update this path to your compiled package JSON
export const compiledModulesandDependencies = '../compiled-sui-package/your-package.json'
```

## Usage

### Deploy Your Package

Run the deployment script:

```bash
npm run publish
```

This script will:

1. **Load your compiled package** from the JSON file
2. **Create a Sui transaction** with the package publication
3. **Set gas parameters** (default: 100,000,000 gas units)
4. **Transfer the upgrade capability** to your vault address
5. **Submit the transaction** to Fordefi for signing and execution
6. **Return the transaction result**

### What the Script Does

The `deploy.ts` script performs these steps:

1. **Initialize Sui client** - Connects to Sui mainnet
2. **Load compiled bytecode** - Reads your package JSON file
3. **Build transaction** - Creates a Sui transaction with:
   - Package publication with modules and dependencies
   - Transfer of upgrade capability to your address
   - Gas budget configuration
4. **Submit to Fordefi** - Sends the transaction through Fordefi's API for MPC signing

## Configuration Options

### Network Configuration

The default configuration uses Sui mainnet. To use a different network, update `configs.ts`:

```typescript
// For testnet
export const suiNetwork = "https://fullnode.testnet.sui.io:443"

// For devnet  
export const suiNetwork = "https://fullnode.devnet.sui.io:443"
```

### Gas Budget

The default gas budget is set to 100,000,000 gas units. Adjust in `deploy.ts` if needed:

```typescript
tx.setGasBudget(50_000_000n); // Lower gas budget
```

## Troubleshooting

### Common Issues

1. **"Failed to read compiled package"** - Ensure your JSON file path is correct in `configs.ts`
2. **"Insufficient gas"** - Increase the gas budget in the transaction
3. **"Invalid bytecode"** - Ensure you ran `sui move build --dump-bytecode-as-base64`

### Package Building

If you need to rebuild your package:

```bash
# In your Move package directory
sui move build --dump-bytecode-as-base64 --path .
```

This will generate the JSON file with the required format for deployment.