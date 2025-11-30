# Hyperliquid-Fordefi Integration

A TypeScript application for interacting with Hyperliquid's DEX (aka HyperCore) through Fordefi.

## Overview

This application enables secure interactions with the Hyperliquid L1 DEX from a Fordefi EVM Vault. It provides functionality for:

- Depositing USDC from your Fordefi EVM Vault to Hyperliquid
- Withdrawing funds from Hyperliquid to your Fordefi EVM Vault
- Sending USDC within the Hyperliquid ecosystem
- Transferring tokens from Perps to Spot DEX
- Vault transfers using API/Agent wallets (for L1 Actions)

## Important: Hyperliquid Signing Schemes

Hyperliquid uses two different signing schemes that require different wallet types:

### 1. User-Signed Actions (✅ Fordefi Supported)
These actions use EIP-712 signatures with the actual network chainId (e.g., 42161 for Arbitrum):
- **usdSend** - Send USDC within Hyperliquid
- **withdraw3** - Withdraw from Hyperliquid to Arbitrum
- **deposit** - Deposit USDC from Arbitrum to Hyperliquid
- **spotTransfer** - Transfer tokens between Perps and Spot DEX

**Implementation**: Use Fordefi wallet directly via the wallet adapter (`wallet-adapter.ts`)

### 2. L1 Actions (❌ Fordefi NOT Supported)
These actions use EIP-712 signatures with chainId 1337, which is NOT a real blockchain network:
- **vaultTransfer** - Deposit/withdraw from Hyperliquid vaults

**Why Fordefi Cannot Sign L1 Actions**:
- Fordefi's signing infrastructure requires chainId to correspond to an actual blockchain network
- ChainId 1337 is a special value used by Hyperliquid for L1 actions
- Attempting to sign with chainId 1337 results in signature recovery errors

**Solution**: Use API/Agent wallets (standard Ethereum private keys) for L1 actions
- Agent wallets can sign with arbitrary chainIds including 1337
- Must be approved by your Fordefi account first
- Cannot perform withdrawals
- Sign on behalf of the master account (Fordefi account)
- See `hl-vault-transfer-agent.ts` for implementation example

## Prerequisites

- Fordefi organization and EVM vault
- Node.js and npm installed
- Fordefi credentials: API User access token, API User private key and API Signer set up ([documentation](https://docs.fordefi.com/developers/program-overview))
- **(Optional)** Agent wallet private key for L1 Actions like vault transfers
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

6. **(Optional)** For L1 Actions like vault transfers, add your agent wallet private key to `.env`:
   ```bash
   HYPERCORE_AGENT_PK=0x...
   ```
   **Note**: The agent wallet must be approved by your master account (Fordefi account) first using the `approveAgent` action.

## Fordefi Configuration

The application is configured through the `config.ts` file:

```typescript
export const fordefiConfig: FordefiProviderConfig = {
    chainId: 42161, // Arbitrum
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // Your Fordefi EVM Vault
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    skipPrediction: false 
};
```

## Usage

All actions are controlled by simply changing the `action` field in `hyperliquidConfig` in `src/config.ts`. No need to modify `run.ts`.

First, ensure that your Fordefi API Signer is running.

### Deposit USDC to Hyperliquid

To deposit USDC from your Fordefi EVM Vault to Hyperliquid:

1. Make sure you have sufficient USDC in your Fordefi EVM Vault on the Arbitrum chain.
2. Set the action to `"deposit"` in `src/config.ts` (minimum 5 USDC required):

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "deposit",
    isTestnet: false,
    destination: fordefiConfig.address, // Not used for deposit but required by config
    amount: "5" // Amount must be at least 5 USDC
};
```

3. Run the command:

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

### Approve Agent Wallet

Before an agent wallet can perform L1 actions, it must be approved by your master account (Fordefi vault):

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

### Revoke Agent Wallet

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

### Vault Transfer (L1 Action - Requires Agent Wallet)

To deposit or withdraw from a Hyperliquid vault:

1. Ensure you have set up your agent wallet private key in `.env`:
```bash
HYPERCORE_AGENT_PK=0x...
```

2. Change the action to `"vault_transfer"` in `src/config.ts`:
```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "vault_transfer",
    isTestnet: false,
    destination: "0x...", // Not used but required
    amount: "1",
    agentPk: process.env.HYPERCORE_AGENT_PK,
    isDeposit: true // true for deposit, false for withdrawal,
    hyperliquid_vault_address: "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303" // HLP Vault, can be changed
};
```

3. Run:
```bash
npm run start
```

**Important Notes**:
- Agent wallet must be approved by your master account first (see "Approve Agent Wallet" section)
- Agent wallet signs on behalf of your Fordefi vault address

### Quick Action Reference

Simply change the `action` field in `src/config.ts` and run `npm run action`:

| Action | Description | Wallet Type | Config Example |
|--------|-------------|-------------|----------------|
| `deposit` | Deposit USDC to Hyperliquid | Fordefi | `action: "deposit", amount: "5"` |
| `withdraw` | Withdraw from Hyperliquid | Fordefi | `action: "withdraw", destination: "0x...", amount: "1"` |
| `sendUsd` | Send USDC within Hyperliquid | Fordefi | `action: "sendUsd", destination: "0x...", amount: "1"` |
| `spotTransfer` | Transfer between Perps and Spot | Fordefi | `action: "spotTransfer", token: "USDC:0x...", toSpot: true` |
| `approve_agent` | Approve agent wallet | Fordefi | `action: "approve_agent", agentName: "my_agent"` |
| `revoke_agent` | Revoke agent wallet | Fordefi | `action: "revoke_agent", agentName: "my_agent"` |
| `vault_transfer` | Vault deposit/withdrawal | Agent | `action: "vault_transfer", isDeposit: true, amount: "1"` |

## Troubleshooting

### Common Issues

1. **"FORDEFI_API_USER_TOKEN is not set"**
   - Ensure your `.env` file contains a valid Fordefi API user token

2. **"PEM_PRIVATE_KEY is not set"**
   - Make sure your private key file exists at `./fordefi_secret/private.pem`

3. **"Insufficient balance"**
   - Your account doesn't have enough funds for the requested withdrawal amount

4. **"Deposit amount must be at least 5 USDC"**
   - Hyperliquid requires a minimum deposit of 5 USDC

5. **USDC Approval Errors**
   - Ensure your Fordefi vault has enough USDC for the deposit
   - Check that your vault has approved the Hyperliquid bridge contract

6. **"L1 Actions with chainId 1337 are not supported by Fordefi"**
   - This error occurs when trying to use Fordefi wallet for L1 actions
   - Solution: Use the agent wallet implementation (see `hl-vault-transfer-agent.ts`)
   - Make sure `HYPERCORE_AGENT_PK` is set in your `.env` file

7. **"User or API Wallet does not exist"**
   - Your agent wallet has not been approved by the master account
   - Solution: Run the `approveAgent` action first with your master account
   - The agent wallet must be approved before it can sign on behalf of the master account

## Architecture Notes

### Wallet Types
This integration uses two different wallet types:

1. **Fordefi Wallet** (`wallet-adapter.ts`)
   - Used for User-Signed Actions (usdSend, withdraw3, deposit)
   - Managed through Fordefi's MPC infrastructure
   - Requires API User Token and API Signer
   - Cannot sign messages with chainId 1337

2. **Agent Wallet** (`hl-vault-transfer-agent.ts`)
   - Used for L1 Actions (vaultTransfer, approveAgent, etc.)
   - Standard Ethereum private key stored in `.env`
   - Can sign with arbitrary chainIds including 1337
   - Must be approved by master account to sign on its behalf