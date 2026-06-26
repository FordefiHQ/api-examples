# Hyperliquid-Fordefi Integration

A TypeScript application for interacting with Hyperliquid's DEX (aka HyperCore) through Fordefi.

## Overview

This application enables secure interactions with the Hyperliquid L1 DEX from a Fordefi EVM Vault. It provides functionality for:

- Depositing USDC from your Fordefi EVM Vault to Hyperliquid
- Withdrawing funds from Hyperliquid to your Fordefi EVM Vault
- Sending USDC within the Hyperliquid ecosystem
- Transferring tokens from Perps to Spot DEX
- Placing perpetual orders
- Vault transfers (deposits/withdrawals to Hyperliquid vaults)
- Approving and revoking agent wallets

## ChainId Configuration

Fordefi supports signing with chainId 1337 for most Hyperliquid actions. Configure the `chainId` in `fordefiConfig` based on the action you want to perform:

> **⚠️⚠️Important**: Support for signing messages with chainId 1337 must be manually activated by the Fordefi team for your organization. Please contact Fordefi if you need this feature enabled.

### chainId: 1337 (Default - works for most actions)

Use chainId 1337 for:

- **vault_transfer** - Deposit/withdraw from Hyperliquid vaults
- **approve_agent** - Approve an agent wallet
- **revoke_agent** - Revoke an agent wallet
- **withdraw** - Withdraw from Hyperliquid to Arbitrum
- **sendUsd** - Send USDC within Hyperliquid
- **spotTransfer** - Transfer tokens between Perps and Spot DEX
- **subAccountTransfer** - Transfer between the master account and one of its sub-accounts

### chainId: 42161 (Required for deposit only)

Use chainId 42161 (Arbitrum) for:

- **deposit** - Deposit USDC from Arbitrum to Hyperliquid (on-chain transaction)

**Recommendation**: Keep chainId set to 1337 for most operations, and switch to 42161 only when performing deposits.

## Testnet mode

To run against Hyperliquid **testnet**, set `isTestnet: true` in `hyperliquidConfig` (`src/config.ts`):

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "subAccountTransfer",
    isTestnet: true,   // routes all L1 actions to the Hyperliquid testnet API
    // ...
};
```

This routes every L1 action (`withdraw`, `sendUsd`, `spotTransfer`, `subAccountTransfer`,
`vault_transfer`, `approve_agent`, `revoke_agent`, `placeOrder`) to the Hyperliquid testnet host.

Notes:

- **Signing is unchanged** — testnet L1 actions still sign with chainId `1337` (`0x539`), so no extra
  Fordefi enablement is needed beyond what mainnet already requires.
- **Funding**: use the [Hyperliquid testnet faucet](https://app.hyperliquid-testnet.xyz) to get mock
  USDC. You do **not** bridge from Arbitrum — the `deposit` action is **disabled on testnet** (it uses
  Arbitrum-mainnet bridge/USDC addresses) and will throw a clear error if `isTestnet: true`.
- **Sub-accounts**: create the sub-account in the testnet UI first, then use its address as
  `transfer.to`. (This example has no `createSubAccount` action.)
- For a **spot** `subAccountTransfer` on testnet, the `token` id differs from mainnet — use the
  testnet token id. For **perps** transfers no `token` is needed.

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
export const fordefiConfig: FordefiApiConfig = {
    chainId: 1337,  // Use 1337 for all actions except deposit (use 42161 for deposit)
    address: process.env.FORDEFI_EVM_VAULT_ADDRESS ?? '0x...',
    vaultId: process.env.FORDEFI_EVM_VAULT_ID ?? (() => { throw new Error('FORDEFI_EVM_VAULT_ID is not set'); })(),
    accessToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(),
    privateKeyPath: './secret/private.pem',
    pathEndpoint: '/api/v1/transactions/create-and-wait',
    rpcUrl: 'https://1rpc.io/arb',
    pushMode: 'auto', // set to 'manual' to get the signed tx without broadcasting
};
```

### Push Mode

The `pushMode` setting controls whether transactions are broadcast after MPC signing:

- **`"auto"`** (default) — Fordefi broadcasts the transaction automatically after signing. The Hyperliquid SDK receives the signature and submits the action to Hyperliquid.
- **`"manual"`** — Fordefi signs the transaction but does **not** broadcast it. The wallet adapter throws a `SignatureOnlyError` containing the raw signature hex, which aborts the SDK's broadcast step. This is useful when you need the raw signature for custom submission logic or inspection.

Example: extracting a signature without broadcasting:

```typescript
import { findSignatureOnlyError } from './wallet-adapter';

try {
    await exchClient.withdraw3({ destination, amount });
} catch (error) {
    const sigOnly = findSignatureOnlyError(error);
    if (sigOnly) {
        console.log("Raw signature:", sigOnly.signature);
    }
}
```

> **Note**: `pushMode` applies to on-chain transactions (deposit). For EIP-712 L1 actions, the manual mode is handled by the wallet adapter's `SignatureOnlyError` mechanism.

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

### Sub-account Transfers

To move funds between your master account (the Fordefi vault) and one of its sub-accounts, use the `subAccountTransfer` action. You only describe *what* to move and *which* sub-account is involved; the integration routes to the correct Hyperliquid SDK call.

1. Change the action to `"subAccountTransfer"` and configure `transfer` in `src/config.ts`:

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "subAccountTransfer",
    isTestnet: false,
    transfer: {
        market: "perps",                    // "spot" | "perps"
        from: "master",                     // "master" or "0x<subaccount>"
        to: "0x<subaccount>",               // "master" or "0x<subaccount>"
        amount: "5",
        // token: "USDC:0x6d1e7cde53ba9467b783cb7c530ce054", // required when market: "spot"
    },
};
```

2. Run:

```bash
npm run action
```

The sub-account address can be set inline or via the `SUBACCOUNT_ADDRESS` env var (used as `transfer.to`):

```bash
ACTION=subAccountTransfer SUBACCOUNT_ADDRESS=0x<your-subaccount> npm run action
```

**How `from`/`to` routes** (the Fordefi vault is always the signer, i.e. the *master* account):

| `from` | `to` | What happens |
|--------|------|--------------|
| `"master"` | `"0xSUB"` | master → sub-account (`isDeposit: true`) |
| `"0xSUB"` | `"master"` | sub-account → master (`isDeposit: false`) |

**Notes**:
- `market: "perps"` moves USDC on the Perps DEX; `market: "spot"` moves a spot token and **requires** the `token` field (format `TOKEN_NAME:TOKEN_ADDRESS`).
- Exactly one of `from`/`to` must be `"master"`. Hyperliquid has no native sub-account → sub-account call (a single action only names one sub-account plus a direction). To move between two sub-accounts, run two transfers: sub → master, then master → sub.

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

### Place Perpetual Orders

To place orders on Hyperliquid's perpetual DEX:

1. Change the action to `"placeOrder"` and configure the order in `src/config.ts`:

```typescript
export const hyperliquidConfig: HyperliquidConfig = {
    action: "placeOrder",
    isTestnet: false,
    destination: fordefiConfig.address,
    amount: "1" // Required by config but not used for orders
};

export const orderConfig: OrderParameters = {
    orders: [{
        a: 0,        // Asset index (0 = BTC, 1 = ETH, etc.)
        b: true,     // Buy side (true = buy/long, false = sell/short)
        p: "",       // Price (leave empty to use mid price)
        s: "0.01",   // Size in asset units
        r: false,    // Reduce only
        t: { limit: { tif: "Gtc" } }, // Order type (Gtc, Alo, Ioc)
    }],
};
```

2. Run:

```bash
npm run action
```

**Order Parameters**:
- `a`: Asset index - find the index for your desired asset from Hyperliquid's asset list
- `b`: Side - `true` for buy/long, `false` for sell/short
- `p`: Limit price - leave empty to automatically use the current mid price
- `s`: Order size in asset units (e.g., "0.01" for 0.01 BTC)
- `r`: Reduce only - set to `true` to only reduce existing positions
- `t`: Order type - supports `limit` with time-in-force options:
  - `Gtc` (Good til cancelled)
  - `Alo` (Add liquidity only / post-only)
  - `Ioc` (Immediate or cancel)

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
| `subAccountTransfer` | Transfer between master and a sub-account | `action: "subAccountTransfer"` + configure `transfer` |
| `approve_agent` | Approve agent wallet | `action: "approve_agent", agentName: "my_agent"` |
| `revoke_agent` | Revoke agent wallet | `action: "revoke_agent", agentName: "my_agent"` |
| `vault_transfer` | Vault deposit/withdrawal | `action: "vault_transfer", isDeposit: true, amount: "1"` |
| `placeOrder` | Place perpetual orders | `action: "placeOrder"` + configure `orderConfig` |

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

### Direct API Integration

This integration calls the Fordefi API directly (no `@fordefi/web3-provider` or ethers.js signer). The `FordefiWalletAdapter` in `wallet-adapter.ts` implements the wallet interface expected by the `@nktkas/hyperliquid` SDK:

1. The SDK calls `wallet.signTypedData()` with EIP-712 typed data
2. The adapter constructs a Fordefi API payload, signs it with the API User's RSA private key, and POSTs to Fordefi
3. Fordefi performs MPC signing and returns the raw signature
4. The adapter returns the signature to the SDK, which submits the action to Hyperliquid

Key details:
- The adapter overrides the EIP-712 domain `chainId` with the configured value (1337 for L1 actions)
- `ethers` v6 is used only for ABI encoding (deposit calldata) — not for signing or provider functionality
- Two Fordefi API endpoints are used:
  - `/api/v1/transactions/create-and-wait` — blocks until signed (EIP-712 L1 actions)
  - `/api/v1/transactions` — returns immediately, requires polling (on-chain deposit)
- No external agent wallets required — all actions can be performed directly with the Fordefi vault
