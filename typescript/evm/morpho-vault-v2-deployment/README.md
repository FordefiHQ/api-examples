# Morpho VaultV2 USDC Deployment with Fordefi

> **Note**: This repository is pre-configured to deploy a **USDC vault on Base**. Morpho vaults are single-token contracts - each vault holds only one underlying asset. See [Customizing for Other Tokens](#customizing-for-other-tokens) if you want to deploy a vault with a different underlying asset.

#### ⚠️ DISCLAIMER

**This repository is provided for educational purposes only. The Morpho Association cannot be held responsible for any loss of funds, damages, or other consequences that may result from using this script or any associated code. Use at your own risk.**

**By using this script, you acknowledge that:**
- You understand the risks associated with smart contract deployment and cryptocurrency transactions
- You have thoroughly tested the script in a safe environment before any mainnet deployment
- You are solely responsible for any funds or assets that may be lost due to bugs, errors, or misuse
- The code is provided "as is" without any warranties or guarantees

**Please ensure you understand the code and test thoroughly before deploying to mainnet.**

---

## Overview

This repository provides a comprehensive deployment solution for Morpho VaultV2 using a Morpho VaultV1 as a yield source. **Deployment is performed via a Fordefi EVM vault**, providing secure key management and transaction signing.

**Default Configuration:**

- **Underlying Asset**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Network**: Base Mainnet
- **VaultV1**: Morpho USDC vault (`0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A`)

See VaultV2 deployment documentation [here](https://docs.morpho.org/learn/concepts/vault-v2/).

You can find a detailed explanation of the script, allowing you to build your own deployment script [here](docs/build_own_script.md).

### Understanding VaultV2 Architecture

**VaultV2 is not a wrapper around VaultV1** - it's a modular meta-vault that uses **adapters** to connect to various yield sources. This is a fundamental architectural shift from VaultV1:

| Aspect | VaultV1 | VaultV2 |
|--------|---------|---------|
| **Yield Sources** | Tightly coupled to Morpho Markets V1 only | Protocol-agnostic via adapters |
| **Interest Calculation** | Automatic from Morpho Market V1 | Aggregated from adapters via `realAssets()` |
| **Extensibility** | Limited to Morpho ecosystem | Can support any on-chain yield source |

**What are Adapters?**

Adapters are smart contracts that act as "translators" between VaultV2 and external yield sources. Each adapter:

- Contains logic to allocate/deallocate funds to a target protocol
- Implements `realAssets()` to report current asset values in real-time
- Must be enabled via `addAdapter` (a timelocked action) before use

**Available Morpho Adapters:**

| Adapter | Purpose |
|---------|---------|
| `MorphoVaultV1Adapter` | Connects VaultV2 to an existing VaultV1 |
| `MorphoMarketV1Adapter` | Connects VaultV2 directly to Morpho V1 markets |

This repository deploys a VaultV2 with a `MorphoVaultV1Adapter`, but the architecture supports adding multiple adapters to diversify yield sources.

### How It Works

```text
VaultV2 (your new vault)
    ├── MorphoVaultV1Adapter ──► VaultV1 (e.g., USDC vault) ──► Underlying Asset
    ├── [Optional: MorphoMarketV1Adapter] ──► Morpho Market V1
    └── [Optional: Future adapters] ──► Other yield sources
```

- **VaultV2** is a modular meta-vault that manages capital allocation across one or more adapters
- **Adapters** translate VaultV2 instructions into protocol-specific actions and report yield back
- **VaultV1** (in this deployment) serves as the yield source via the `MorphoVaultV1Adapter`
- The **underlying asset** (e.g., USDC) is determined by the VaultV1 you choose

**Why use VaultV2 with a VaultV1 adapter?**

1. **Future flexibility**: Add more adapters later without redeploying
2. **Unified interface**: Manage multiple yield sources from a single vault
3. **Enhanced risk controls**: VaultV2 provides granular caps and role-based permissions
4. **Automatic yield aggregation**: Adapters report values in real-time via `realAssets()`

### Deployment Components

This script deploys and configures:

- **VaultV2 Instance**: The main vault contract (created via VaultV2Factory)
- **MorphoVaultV1Adapter**: Connects your VaultV2 to VaultV1 (created via MorphoVaultV1AdapterFactory)
- **Role Configuration**: Owner, Curator, Allocator, and optional Sentinel
- **Caps & Registry**: Adapter caps and registry configuration for risk management

### Configuring the Yield Source

The yield source is configured via the `VAULT_V1` environment variable. This determines:

1. **Which VaultV1** your VaultV2 will use as its yield source
2. **The underlying asset** - automatically inferred from the VaultV1's `asset()` function

**Finding available VaultV1s:**

Browse existing Morpho VaultV1s at [https://app.morpho.org/](https://app.morpho.org/). Filter by network (Base, Ethereum, etc.) and underlying asset (USDC, WETH, etc.) to find a vault that matches your needs. Each vault page displays its contract address.

**Important:** All VaultV1s you connect to must share the same underlying asset as your VaultV2 (e.g., all USDC vaults).

**In the deployment script ([deploy.ts:130](script/deploy.ts#L130)):**

```typescript
const adapterTx = await callContract(
  morphoAdapterFactory,
  "createMorphoVaultV1Adapter",
  vaultV2Address,
  VAULT_V1  // ← Your yield source
);
```

**Current limitation:** This script deploys a single `MorphoVaultV1Adapter`. To add multiple yield sources (multiple VaultV1s or other adapters), you would need to:

1. Call `createMorphoVaultV1Adapter` for each additional VaultV1
2. Call `addAdapter` for each new adapter
3. Configure caps for each adapter via `increaseAbsoluteCap` and `increaseRelativeCap`

This can be done post-deployment by the Curator, subject to timelock constraints.

### Required Environment Variables

**Fordefi Configuration:**
- `FORDEFI_API_USER_TOKEN`: Your Fordefi API User access token
- `FORDEFI_EVM_VAULT_ADDRESS`: Your Fordefi EVM vault address (used as deployer)
- `RPC_URL`: Your RPC endpoint URL

**Role Addresses (all default to `FORDEFI_EVM_VAULT_ADDRESS` if not set):**
- `OWNER`: Address of the Owner role (defaults to your Fordefi vault)
- `CURATOR`: Address of the Curator role (defaults to your Fordefi vault)
- `ALLOCATOR`: Address of an Allocator role (defaults to your Fordefi vault)
- `SENTINEL`: Address of a Sentinel role (optional, no default)

**Contract Configuration:**
- `VAULT_V1`: Address of the VaultV1 to use as liquidity market
- `ADAPTER_REGISTRY`: Address of the Adapter Registry
- `VAULT_V2_FACTORY`: Address of the VaultV2 Factory
- `MORPHO_VAULT_V1_ADAPTER_FACTORY`: Address of the MorphoVaultV1 Adapter Factory
- `TIMELOCK_DURATION`: Timelock duration in seconds (set to 0 for immediate execution)

**Note**: The underlying asset token is automatically inferred from the VaultV1 configuration.

## Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Foundry](https://getfoundry.sh/) (for building contracts)
- [Git](https://git-scm.com/)
- A Fordefi workspace with an EVM vault

### 2. Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:morpho-org/vault-v2-deployment.git
   cd vault-v2-deployment
   ```

2. Install Solidity dependencies:
   ```bash
   git submodule update --init --recursive
   ```

3. Install Node.js dependencies:
   ```bash
   npm install
   ```

4. Build the contracts (generates ABIs for the TypeScript deployment script):
   ```bash
   forge build
   ```

### 3. Configure Fordefi

1. Place your Fordefi API User private key at `./fordefi_secret/private.pem`

2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file with your configuration:
   ```bash
   # VaultV2 Deployment Environment Variables

   # ===========================================
   # Fordefi Provider Configuration (Required)
   # ===========================================
   FORDEFI_API_USER_TOKEN=your_api_user_token_here
   FORDEFI_EVM_VAULT_ADDRESS=0xYourFordefiVaultAddress
   RPC_URL=https://mainnet.base.org

   # ===========================================
   # Role Addresses (all default to FORDEFI_EVM_VAULT_ADDRESS)
   # ===========================================
   # Uncomment and set these only if you want different addresses
   # OWNER=0xYourOwnerAddress
   # CURATOR=0xYourCuratorAddress
   # ALLOCATOR=0xYourAllocatorAddress
   # SENTINEL=0xYourSentinelAddress  # Optional, no default

   # ===========================================
   # Timelock Configuration
   # ===========================================
   TIMELOCK_DURATION=1814400  # 21 days in seconds, or 0 for immediate

   # ===========================================
   # Contract Addresses (Base Network)
   # ===========================================
   ADAPTER_REGISTRY=0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a
   VAULT_V2_FACTORY=0x4501125508079A99ebBebCE205DeC9593C2b5857
   MORPHO_VAULT_V1_ADAPTER_FACTORY=0xF42D9c36b34c9c2CF3Bc30eD2a52a90eEB604642
   VAULT_V1=0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A
   ```

   **⚠️ Security Note**: Never commit your `.env` file or `fordefi_secret/` directory to version control. Both are included in `.gitignore`.

### 4. Deploy VaultV2

The deployment script creates a new VaultV2 instance and configures it to work with a VaultV1 as the liquidity market. The script handles:

- VaultV2 creation via the VaultV2Factory
- MorphoVaultV1Adapter deployment and configuration
- Role assignment and timelock configuration
- Adapter registry setup and caps configuration

Run the deployment script:

```bash
npm run deploy
```

The script will:
1. Connect to your Fordefi vault
2. Deploy a new VaultV2 instance via the factory
3. Deploy and configure the MorphoVaultV1 adapter
4. Set up all roles (owner, curator, allocator, sentinel)
5. Configure timelocks if specified
6. Execute a dead deposit for inflation attack protection
7. Output the deployed contract addresses

### Dead Deposit (Inflation Attack Protection)

By default, the deployment script performs a **dead deposit** of 1 USDC (1,000,000 units with 6 decimals) to protect against [ERC-4626 inflation attacks](https://docs.morpho.org/build/earn/concepts/vault-mechanics#inflation-attack-protection).

**How it works:**
- The script deposits the underlying asset to address `0xdead`, permanently locking those shares
- This ensures a minimum share supply that prevents attackers from manipulating the share price
- Your Fordefi vault must hold at least 1 unit of the underlying asset (e.g., 1 USDC)

**Configuring the dead deposit amount:**

The default amount (`1000000`) is optimized for USDC on Base (6 decimals = $1). For vaults with different underlying assets, you should adjust the amount:

| Underlying Asset | Decimals | Recommended Amount | Value |
|------------------|----------|-------------------|-------|
| USDC, USDT | 6 | `1000000` (default) | $1.00 |
| WETH | 18 | `1000000000000000` | 0.001 WETH |
| WBTC | 8 | `1000` | 0.00001 WBTC |

Set the amount in your `.env` file:
```bash
# For 18-decimal tokens (e.g., WETH, DAI)
DEAD_DEPOSIT_AMOUNT=1000000000000000

# To skip dead deposit (not recommended for public vaults)
DEAD_DEPOSIT_AMOUNT=0
```

**Important:** The underlying asset is automatically inferred from the VaultV1 you specify. Ensure you have sufficient balance of that asset in your Fordefi vault.

### Default Role Configuration

By default, **all roles are assigned to your Fordefi EVM vault address** (`FORDEFI_EVM_VAULT_ADDRESS`):

| Role | Default | Description |
|------|---------|-------------|
| `OWNER` | Your Fordefi vault | Full control over the vault |
| `CURATOR` | Your Fordefi vault | Can manage vault parameters |
| `ALLOCATOR` | Your Fordefi vault | Can allocate funds to adapters |
| `SENTINEL` | None (optional) | Can perform emergency actions |

To use different addresses for any role, simply set the corresponding environment variable in your `.env` file.

## Testing Deployment

### Test Deployment on Anvil

For testing purposes, you can use the provided test deployment script that runs on a local Anvil instance:

```bash
# Run the test deployment script
./deploy_anvil.sh
```

This script will:
- Start a local Anvil blockchain
- Deploy mock contracts (ERC20Mock, ERC4626Mock, AdapterRegistryMock)
- Deploy factory contracts (VaultV2Factory, MorphoVaultV1AdapterFactory)
- Deploy the VaultV2 with test configuration
- Display deployment results and configuration
- Clean up and stop Anvil

**Note**: This is for testing only and uses temporary mock contracts. Do not use this for production deployments.

### Running Tests

The repository includes comprehensive tests:

```bash
# Run all tests
forge test

# Run tests with verbose output
forge test -vvv

# Run specific test file
forge test --match-path test/DeployVaultV2.t.sol
```

### GitHub Actions Integration

The repository includes GitHub Actions workflows for automated testing:

- **CI Workflow** (`.github/workflows/test.yml`): Runs tests, formatting, and build checks
- **Test Deployment Workflow** (`.github/workflows/test-deployment.yml`): Runs the test deployment script on Anvil

These workflows run automatically on pushes and pull requests, and can also be triggered manually.

## Quick Reference

### Environment Variables Summary

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FORDEFI_API_USER_TOKEN` | Yes | - | Fordefi API User access token |
| `FORDEFI_EVM_VAULT_ADDRESS` | Yes | - | Your Fordefi EVM vault address |
| `RPC_URL` | Yes | - | RPC endpoint URL |
| `OWNER` | No | `FORDEFI_EVM_VAULT_ADDRESS` | Owner role address |
| `CURATOR` | No | `FORDEFI_EVM_VAULT_ADDRESS` | Curator role address |
| `ALLOCATOR` | No | `FORDEFI_EVM_VAULT_ADDRESS` | Allocator role address |
| `SENTINEL` | No | None | Sentinel role address (optional) |
| `VAULT_V1` | Yes | - | VaultV1 address to use |
| `ADAPTER_REGISTRY` | Yes | - | Adapter Registry address |
| `VAULT_V2_FACTORY` | Yes | - | VaultV2 Factory address |
| `MORPHO_VAULT_V1_ADAPTER_FACTORY` | Yes | - | MorphoVaultV1 Adapter Factory address |
| `TIMELOCK_DURATION` | No | `0` | Timelock in seconds |
| `DEAD_DEPOSIT_AMOUNT` | No | `1000000` (1 USDC) | Dead deposit for inflation protection |

### Common Commands

```bash
# Setup
cp .env.example .env
# Edit .env with your values

# Install dependencies
git submodule update --init --recursive
npm install

# Build contracts
forge build

# Run tests
forge test

# Deploy with Fordefi
npx ts-node script/deploy.ts

# Test deployment on Anvil
./deploy_anvil.sh

# Format Solidity code
forge fmt
```

### Base Network Contract Addresses

These are the official Morpho V2 contract addresses on Base:

| Contract | Address |
|----------|---------|
| Adapter Registry | `0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a` |
| VaultV2 Factory | `0x4501125508079A99ebBebCE205DeC9593C2b5857` |
| MorphoVaultV1 Adapter Factory | `0xF42D9c36b34c9c2CF3Bc30eD2a52a90eEB604642` |

See [Morpho documentation](https://docs.morpho.org/get-started/resources/addresses/#morpho-v2-contracts) for addresses on other networks.

## Customizing for Other Tokens

This repository is pre-configured for **USDC vaults on Base**, but you can deploy vaults with other underlying assets. Morpho vaults are **single-token contracts** - each vault holds exactly one underlying asset.

To deploy a vault with a different token:

1. **Find a Morpho VaultV1 with your desired underlying asset**:
   - Browse available VaultV1s on [Morpho's interface](https://app.morpho.org/)
   - The underlying asset is determined by the VaultV1 you choose

2. **Update your `.env` file**:

   ```bash
   # Set the VaultV1 address for your desired underlying asset
   VAULT_V1=0xYourVaultV1Address

   # Adjust dead deposit amount for the token's decimals
   # Examples:
   # USDC/USDT (6 decimals): 1000000 = $1
   # WETH/DAI (18 decimals): 1000000000000000000 = 1 token
   # WBTC (8 decimals): 100000000 = 1 WBTC
   DEAD_DEPOSIT_AMOUNT=1000000000000000000
   ```

3. **Ensure your Fordefi vault has sufficient balance** of the underlying asset for the dead deposit

**Important**: The underlying asset is automatically inferred from the VaultV1 contract. The script will fetch it via the `asset()` function call.
