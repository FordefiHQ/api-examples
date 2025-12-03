# Hyperliquid-Fordefi Integration

A TypeScript application for interacting with Hyperliquid's DEX (aka HyperCore) through Fordefi.

## Overview

This application enables secure interactions with the Hyperliquid L1 DEX from a Fordefi EVM Vault. It provides functionality for:

- Depositing USDC from your Fordefi EVM Vault to Hyperliquid
- Withdrawing funds from Hyperliquid to your Fordefi EVM Vault
- Sending USDC within the Hyperliquid ecosystem
- Transferring tokens from Perps to Spot DEX
- Vault transfers (deposits/withdrawals to Hyperliquid vaults)

## ChainId Configuration

Fordefi supports signing with chainId 1337 for most Hyperliquid actions. Configure the `chainId` in `fordefiConfig` based on the action you want to perform:

### chainId: 1337 (Default - works for most actions)

Use chainId 1337 for:

- **vault_transfer** - Deposit/withdraw from Hyperliquid vaults
- **approve_agent** - Approve an agent wallet
- **revoke_agent** - Revoke an agent wallet
- **withdraw** - Withdraw from Hyperliquid to Arbitrum
- **sendUsd** - Send USDC within Hyperliquid
- **spotTransfer** - Transfer tokens between Perps and Spot DEX

### chainId: 42161 (Required for deposit only)

Use chainId 42161 (Arbitrum) for:

- **deposit** - Deposit USDC from Arbitrum to Hyperliquid (on-chain transaction)

**Recommendation**: Keep chainId set to 1337 for most operations, and switch to 42161 only when performing deposits.

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- Fordefi credentials: API User access token, API User private key and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))
- TypeScript setup:
  ```bash
  # Install TypeScript and type definitions
  npm install typescript --save-dev
  npm install @types/node --save-dev
  npm install tsx --save-dev
  
  # Initialize a TypeScript configuration file (if not already done)
  npx tsc --init
  ```

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Set up your environment variables:

4. Edit the `.env` file and add your `FORDEFI_API_USER_TOKEN`

5. Place your API User's private key in `./secret/private.pem`

## Fordefi Configuration

The application is configured through the `config.ts` file:

```typescript
export const fordefiConfig: FordefiProviderConfig = {
    chainId: 1337,  // Use 1337 for all actions except deposit (use 42161 for deposit)
    address: '0x...', // Your Fordefi EVM Vault address
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: fs.readFileSync('./secret/private.pem', 'utf8'),
    rpcUrl: 'https://1rpc.io/arb',
    skipPrediction: false
};
```

## Usage

All actions are controlled by simply changing the `action` field in `hyperliquidConfig` in `src/config.ts`. No need to modify `run.ts`.

First, ensure that your Fordefi API Signer is running.

### Deposit USDC to Hyperliquid

To deposit USDC from your Fordefi EVM Vault to Hyperliquid:

1. Make sure you have sufficient USDC in your Fordefi EVM Vault on the Arbitrum chain.
2. **Important**: Set `chainId: 42161` in `fordefiConfig` (deposit is the only action that requires Arbitrum chainId).
3. Set the action to `"deposit"` in `src/config.ts` (minimum 5 USDC required):

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "deposit",
    isTestnet: false,
    destination: fordefiConfig.address, // Not used for deposit but required by config
    amount: "5" // Amount must be at least 5 USDC
};
```

4. Run the command:

```bash
npm run action
```

The deposit process uses USDC's permit functionality to approve and deposit in a single transaction. The function will:
- Fetch the current nonce for your Fordefi vault address
- Create and sign an EIP-712 permit message
- Execute the deposit through Hyperliquid's bridge contract

### Withdraw funds from Hyperliquid

To withdraw funds from Hyperliquid to your Fordefi EVM Vault:

1. Change the action to `"withdraw"` in `src/config.ts`:

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "withdraw",
    isTestnet: false,
    destination: fordefiConfig.address, // Your Fordefi vault address
    amount: "1"
};
```

2. Run:

```bash
npm run action
```

### Send USDC within Hyperliquid

To send USDC to another address within Hyperliquid:

1. Change the action to `"sendUsd"` and set the destination in `src/config.ts`:

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "sendUsd",
    isTestnet: false,
    destination: "0x...", // Change to your destination address
    amount: "1"
};
```

2. Run:

```bash
npm run action
```

### Transfer Tokens between Perps and Spot DEX

To transfer tokens between the Perps DEX and Spot DEX within Hyperliquid:

1. Change the action to `"spotTransfer"` and set the token and direction in `src/config.ts`:

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "spotTransfer",
    isTestnet: false,
    destination: fordefiConfig.address, // Your Fordefi vault address
    amount: "2",
    token: "USDC:0x6d1e7cde53ba9467b783cb7c530ce054", // Token identifier (name:address)
    toSpot: true // true = Perps→Spot, false = Spot→Perps
};
```

2. Run:

```bash
npm run action
```

**Notes**:
- The `token` field uses the format `TOKEN_NAME:TOKEN_ADDRESS` (e.g., `USDC:0x6d1e7cde53ba9467b783cb7c530ce054`)
- Set `toSpot: true` to transfer from Perps to Spot DEX
- Set `toSpot: false` to transfer from Spot to Perps DEX

### Approve Agent Wallet (Optional)

> **Note**: Agent wallets are **not required** for this Fordefi integration. Since Fordefi now supports signing with chainId 1337, all Hyperliquid actions can be performed directly with your Fordefi vault. The agent wallet functionality is documented here for advanced use cases where you may want to delegate signing to a separate key.

To approve an agent wallet:

1. Change the action to `"approve_agent"` in `src/config.ts`:
```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "approve_agent",
    isTestnet: false,
    destination: fordefiConfig.address,
    amount: "1" // Required by config but not used
};

export const agentWalletConfig: AgentWalletConfig = {
    agentName: "my_agent_wallet",
    agentAddress: "", // Leave empty, will be generated automatically
    validUntil: 1893456000000 // Timestamp in milliseconds when approval expires
};
```

2. Run:
```bash
npm run action
```

This will:
- Generate a new Ethereum keypair for the agent wallet
- Save the private key to `agent-private-key.json`
- Approve the agent wallet to act on behalf of your Fordefi vault
- Display the agent wallet address

**Important**: Store the generated private key VERY securely.

### Revoke Agent Wallet (Optional)

To revoke an agent wallet's approval:

1. Change the action to `"revoke_agent"` in `src/config.ts`:
```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "revoke_agent",
    isTestnet: false,
    destination: fordefiConfig.address,
    amount: "1" // Required by config but not used
};

export const agentWalletConfig: AgentWalletConfig = {
    agentAddress: "", // Agent wallet address to revoke, can be left EMPTY
    agentName: "my_agent", // Must match the name used during approval
    validUntil: 1893456000000
};
```

2. Run:
```bash
npm run action
```

### Vault Transfer

To deposit or withdraw from a Hyperliquid vault:

1. Change the action to `"vault_transfer"` in `src/config.ts`:

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "vault_transfer",
    isTestnet: false,
    destination: fordefiConfig.address,
    amount: "1",
    isDeposit: true, // true for deposit, false for withdrawal
    hyperliquid_vault_address: "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303" // HLP Vault, can be changed
};
```

2. Run:

```bash
npm run action
```

### Quick Action Reference

Simply change the `action` field in `src/config.ts` and run `npm run action`:

| Action | Description | Config Example |
|--------|-------------|----------------|
| `deposit` | Deposit USDC to Hyperliquid | `action: "deposit", amount: "5"` |
| `withdraw` | Withdraw from Hyperliquid | `action: "withdraw", destination: "0x...", amount: "1"` |
| `sendUsd` | Send USDC within Hyperliquid | `action: "sendUsd", destination: "0x...", amount: "1"` |
| `spotTransfer` | Transfer between Perps and Spot | `action: "spotTransfer", token: "USDC:0x...", toSpot: true` |
| `approve_agent` | Approve agent wallet | `action: "approve_agent", agentName: "my_agent"` |
| `revoke_agent` | Revoke agent wallet | `action: "revoke_agent", agentName: "my_agent"` |
| `vault_transfer` | Vault deposit/withdrawal | `action: "vault_transfer", isDeposit: true, amount: "1"` |

## Troubleshooting

### Common Issues

1. **"FORDEFI_API_USER_TOKEN is not set"**
   - Ensure your `.env` file contains a valid Fordefi API user token

2. **"PEM_PRIVATE_KEY is not set"**
   - Make sure your private key file exists at `./secret/private.pem`

3. **"Insufficient balance"**
   - Your account doesn't have enough funds for the requested withdrawal amount

4. **"Deposit amount must be at least 5 USDC"**
   - Hyperliquid requires a minimum deposit of 5 USDC

5. **USDC Approval Errors**
   - Ensure your Fordefi vault has enough USDC for the deposit
   - Check that your vault has approved the Hyperliquid bridge contract

## Architecture Notes

### Wallet Implementation

This integration uses the **Fordefi Wallet** (`wallet-adapter.ts`) for all Hyperliquid actions:

- Managed through Fordefi's MPC infrastructure
- Requires API User Token and API Signer
- Supports all signing schemes including chainId 1337 for L1 Actions
- No external agent wallets required
