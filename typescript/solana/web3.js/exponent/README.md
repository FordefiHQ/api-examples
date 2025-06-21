# Exponent Trading Tool

A Solana trading tool for interacting with Exponent markets using Fordefi. This tool leverages the Exponent SDK to handle complex DeFi transactions efficiently.

## Overview

This tool enables automated trading on Exponent markets (Principal Token markets) with the following features:

- **Buy/Sell Principal Tokens (PTs)** on Exponent markets
- **Leverages Exponent's built-in Address Lookup Table** for efficient transactions
- **Two-step transaction workflow** for setup and investment
- **Fordefi integration** for secure transaction signing
- **Smart setup detection** to avoid redundant account creation

## Architecture

### Core Components

1. **`serialize_invest.ts`** - Main trading logic and transaction serialization
2. **`run.ts`** - Orchestration script that manages the multi-step process
3. **`config.ts`** - Configuration management for Fordefi and Exponent settings
4. **Utils** - Helper functions for transaction processing and signing

### Transaction Flow

The tool implements a simplified 2-step process to handle Solana transactions:

```
Step 1: Execute Setup Transaction (create ATAs if needed)
    ↓
Step 2: Execute Main Investment Transaction
```

## Setup

### Prerequisites

- Node.js (v16 or higher)
- Fordefi Solana Vault, API User and API Signer
- Solana wallet with SOL for transaction fees

### Environment Variables

Create a `.env` file in the project root:

```env
FORDEFI_API_TOKEN=your_fordefi_api_token
SOLANA_VAULT_ID=your_solana_vault_id
SOLANA_VAULT_ADDRESS=your_solana_vault_address
```

### Installation

```bash
npm install
```

### Configuration

Edit `config.ts` to configure your trading parameters:

```typescript
export const exponentConfig: ExponentConfig = {
  market: "EJ4GPTCnNtemBVrT7QKhRfSKfM53aV2UJYGAC8gdVz5b", // for example fragSOL market
  investAmount: 1_000n, // Amount in smallest units
  action: "buy", // "buy" or "sell"
};
```

## Usage

### Basic Usage

```bash
npm run invest
```

### Configuration Options

#### Market Selection
- **Find Markets**: A list of available markets can be found at `https://web-api.exponent.finance/api/markets`
- **fragSOL Market**: `EJ4GPTCnNtemBVrT7QKhRfSKfM53aV2UJYGAC8gdVz5b`

#### Trading Actions
- **Buy PTs**: Use base asset to purchase Principal Tokens
- **Sell PTs**: Sell Principal Tokens for base asset

#### Amount Configuration
- Amounts are specified in the smallest unit (lamports for SOL, smallest token unit for other assets)
- Example: `1_000n` = 0.000001 fragSOL (9-decimal token)

## How It Works

The tool leverages the Exponent SDK to simplify the trading process. It automatically fetches the correct Address Lookup Table for the specified market.

### Step 1: Setup Transaction

Creates Associated Token Accounts (ATAs) required for the trade. The tool intelligently checks which accounts already exist and only creates the missing ones. This transaction is skipped if no new accounts are needed.

```typescript
// Checks existing ATAs and only creates missing ones
const ataAddresses = setupIxs.map(ix => ix.keys[1]?.pubkey).filter(Boolean);
const existingAccounts = await connection.getMultipleAccountsInfo(ataAddresses);
const neededSetupIxs = setupIxs.filter((_, index) => existingAccounts[index] === null);
```

### Step 2: Main Investment Transaction

Executes the actual trade (buy or sell) using the market's pre-built ALT and the accounts from the setup step.

```typescript
// Executes the buy/sell transaction
const finalPayload = await createInvestPayload(
  fordefiConfig, 
  exponentConfig,
  ixs,
  lookupTableAccount
);
```

## Key Features

### Efficiency
- **Exponent SDK**: Directly uses the SDK to get market details and the correct Address Lookup Table, removing the need for manual creation or extension.
- **Smart Setup**: Avoids redundant transactions by checking for existing Associated Token Accounts before attempting to create them.

### Transaction Optimization

- **Compute budget management**: Automatically sets appropriate compute units (600,000) and priority fees.
- **Versioned transactions**: Uses V0 transactions for better compression.

### Error Handling

- **Comprehensive validation**: Checks for missing accounts, insufficient funds, and other common issues.
- **Graceful degradation**: Skips unnecessary steps when possible.
- **Detailed logging**: Provides clear feedback on each step's progress.

## Troubleshooting

### Common Issues

#### "insufficient funds" (token error)
**Cause**: Vault doesn't have enough of the required token.
**Solution**: 
- For buy actions: Ensure vault has enough base token.
- For sell actions: Ensure vault has enough PT tokens.

#### "computational budget exceeded"
**Cause**: Transaction is too complex for the default compute limit.
**Solution**: The tool automatically handles this by setting a higher compute limit.

### Debugging

Enable detailed logging by checking the console output:

```bash
npm run invest
```

The tool provides logs for each step:
- Market information and rates
- ALT fetching status
- Account creation progress
- Transaction execution results