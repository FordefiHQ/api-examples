# Solana Batch Transfer With Fordefi

Helper code for performing batch transfers on Solana using your Fordefi Solana vault. Supports both SOL and SPL token batch transfers with optimized transaction sizes using Address Lookup Tables (ALTs).

## Features

- **Batch SOL transfers** - Send SOL to multiple recipients in a single transaction
- **Batch SPL token transfers** - Send any SPL token to multiple recipients
- **Address Lookup Tables** - Reduces transaction size and costs
- **Automatic ATA management** - Creates Associated Token Accounts when needed
- **Dynamic recipient management** - Easy to add/remove recipients

## Prerequisites

- Node.js (v14+)
- Fordefi Solana vault 
- Set up an API Signer ([see here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer))
- Create an API user and access token ([see here](https://docs.fordefi.com/developers/getting-started/create-an-api-user))
- Generate a private/public key pair for your API user ([see here](https://docs.fordefi.com/developers/getting-started/pair-an-api-client-with-the-api-signer))
- Register your API user with your API Signer (same link as above)
- Solana SPL tokens and SOL in your Fordefi Solana Vault

## Setup

1. Clone this repository
2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   FORDEFI_API_TOKEN=your_fordefi_api_user_token
   VAULT_ID=your_fordefi_solana_vault_id
   VAULT_ADDRESS=your_fordefi_solana_vault_address
   ```

4. Create a `secret` directory and place your API user's private key file inside:
   ```bash
   mkdir -p secret
   # Add your private.pem file to the secret directory
   ```

## Configuration

Update `config.ts` to customize your batch transfer:

### Basic Configuration

```typescript
export const batchConfig: BatchConfig = {
  fordefiVault: new PublicKey(fordefiConfig.fordefiSolanaVaultAddress),
  recipientsList: [
    new PublicKey("Recipient1AddressHere"),
    new PublicKey("Recipient2AddressHere"),
    new PublicKey("Recipient3AddressHere")
  ],
  amountPerRecipient: 100n, // Amount in smallest unit
  tableAddress: new PublicKey('YOUR_ALT_ADDRESS_HERE'), // Lookup table address
  action: "batch", // "create", "extend", or "batch"
  isSplBatch: false // true for SPL tokens, false for SOL
};
```

### For SPL Token Transfers

```typescript
// Change the token mint address
export const TOKEN_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC

export const batchConfig: BatchConfig = {
  // ... other config
  amountPerRecipient: 1000000n, // 1 USDC (6 decimals)
  isSplBatch: true // Enable SPL token mode
};
```

## Usage Guide

First ensure that your API Signer is running:

```bash
docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
```

The tool operates in three stages:

### 1. Create Address Lookup Table (ALT)

First, create an ALT to store recipient addresses:

```typescript
export const batchConfig: BatchConfig = {
  // ... your recipients and config
  action: "create",
  isSplBatch: false // doesn't matter for create
};
```

```bash
npm run tx
```

**Output:** You'll get an ALT address. Copy its address from the explorer for the next steps.

### 2. Extend ALT with Recipients

Add your recipient addresses to the ALT:

```typescript
export const batchConfig: BatchConfig = {
  // ... your recipients and config
  tableAddress: new PublicKey('YOUR_NEW_ALT_ADDRESS'),
  action: "extend",
  isSplBatch: true // true if you plan to do SPL transfers, false for SOL
};
```

```bash
npm run tx
```

### 3. Execute Batch Transfer

Now perform the actual batch transfer:

```typescript
export const batchConfig: BatchConfig = {
  // ... your recipients and config
  tableAddress: new PublicKey('YOUR_ALT_ADDRESS'),
  action: "batch",
  isSplBatch: true // true for SPL tokens, false for SOL
};
```

```bash
npm run tx
```

## Complete Examples

### SOL Batch Transfer

```typescript
// config.ts
export const batchConfig: BatchConfig = {
  fordefiVault: new PublicKey(fordefiConfig.fordefiSolanaVaultAddress),
  recipientsList: [
    new PublicKey("Recipient1AddressHere"),
    new PublicKey("Recipient2AddressHere"),
    new PublicKey("Recipient3AddressHere")
  ],
  amountPerRecipient: 50000000n, // 0.05 SOL (9 decimals)
  tableAddress: new PublicKey('YOUR_ALT_ADDRESS'),
  action: "batch",
  isSplBatch: false
};
```

### USDC Batch Transfer

```typescript
// config.ts
export const TOKEN_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC

export const batchConfig: BatchConfig = {
  fordefiVault: new PublicKey(fordefiConfig.fordefiSolanaVaultAddress),
  recipientsList: [
    new PublicKey("Recipient1AddressHere"),
    new PublicKey("Recipient2AddressHere"),
    new PublicKey("Recipient3AddressHere")
  ],
  amountPerRecipient: 10000000n, // 10 USDC (6 decimals)
  tableAddress: new PublicKey('YOUR_ALT_ADDRESS'),
  action: "batch",
  isSplBatch: true
};
```

### Custom SPL Token Transfer

```typescript
// config.ts
export const TOKEN_MINT = "YourTokenMintAddressHere"

export const batchConfig: BatchConfig = {
  fordefiVault: new PublicKey(fordefiConfig.fordefiSolanaVaultAddress),
  recipientsList: [
    new PublicKey("Recipient1AddressHere"),
    new PublicKey("Recipient2AddressHere")
  ],
  amountPerRecipient: 1000000000n, // Adjust based on token decimals
  tableAddress: new PublicKey('YOUR_ALT_ADDRESS'),
  action: "batch",
  isSplBatch: true
};
```

## Important Notes

### Token Amounts
- **SOL**: Uses lamports (1 SOL = 1,000,000,000 lamports)
- **USDC**: Uses micro-USDC (1 USDC = 1,000,000 micro-USDC)
- **Other SPL tokens**: Check the token's decimal places on a Solana explorer

### Recipients
- For **SOL transfers**: Use wallet addresses directly
- For **SPL transfers**: Use wallet addresses (ATAs are created automatically)
- The tool automatically handles Associated Token Account (ATA) creation

### Address Lookup Tables
- ALTs reduce transaction size and fees
- You need one ALT per batch operation
- Can reuse ALTs for multiple batch transfers of the same tokens
- Remember to extend ALT when you add new recipients

## Troubleshooting

### Common Issues

**"Insufficient funds"**
- Check that your Fordefi vault has enough SOL/tokens
- Account for transaction fees

**"Account not found"**
- For SPL tokens, ensure your vault has the token account
- The tool creates recipient ATAs automatically

### Best Practices

1. **Test on devnet first** - Change RPC endpoint to devnet for testing
2. **Start small** - Test with 2-3 recipients before larger batches
3. **Monitor fees** - Use appropriate priority fee levels
4. **Backup ALTs** - Keep track of your ALT addresses for reuse

## File Structure

```
├── config.ts          # Configuration and recipients
├── interfaces.ts      # TypeScript interfaces
├── helpers.ts         # Core batch transfer logic
├── run.ts            # Main execution script
├── process_tx.ts     # Fordefi API integration
├── signer.ts         # API signing utilities
├── secret/
│   └── private.pem   # Your Fordefi API User private key
└── .env              # Environment variables
```