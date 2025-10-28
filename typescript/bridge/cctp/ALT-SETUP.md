# Address Lookup Table (ALT) Setup for CCTP Bridge

This guide explains how to set up an Address Lookup Table (ALT) to reduce transaction size for Solana CCTP bridge transactions.

## Why Do You Need an ALT?

Solana transactions have a size limit. The CCTP `receiveMessage` instruction requires many accounts (20+), which can exceed Fordefi's transaction limits. Address Lookup Tables allow you to reference these accounts by index instead of including their full 32-byte addresses, significantly reducing transaction size.

**Size savings:** ~13 accounts × 32 bytes = **~416 bytes saved**

## Prerequisites

- Fordefi vault configured with Solana mainnet
- API credentials (API_USER_TOKEN and private.pem)
- Environment variables set in `.env`
- Small amount of SOL in your vault for transaction fees (~0.01 SOL)

## Setup Steps

### Step 1: Create the Address Lookup Table

Run the create command:

```bash
npm run create-alt
```

This will:
1. Generate a new ALT address
2. Create a transaction to initialize the ALT
3. Submit the transaction to Fordefi for signing
4. Output the ALT address

**Example output:**
```
=== Step 1: Create Address Lookup Table ===

📍 ALT Address: 7XWz8...abc123
   View at: https://solscan.io/account/7XWz8...abc123

✅ ALT creation transaction submitted
   Transaction ID: tx_...

⏳ Wait 1-2 minutes for the ALT to activate, then run:
   export ALT_ADDRESS=7XWz8...abc123
   npm run extend-alt
```

**Important:** Save the ALT address! You'll need it for the next steps.

### Step 2: Wait for ALT Activation

Address Lookup Tables require ~1-2 minutes to activate after creation. During this time:
- The transaction needs to be confirmed
- Solana's runtime needs to process the new ALT
- The ALT becomes available for extension

You can verify the ALT is ready by checking it on [Solscan](https://solscan.io).

### Step 3: Extend the ALT with CCTP Accounts

Once the ALT is activated, run:

```bash
export ALT_ADDRESS=7XWz8...abc123  # Use your actual ALT address
npm run extend-alt
```

This will:
1. Add 13 CCTP-related accounts to the ALT:
   - Message Transmitter Program ID
   - Token Messenger Minter Program ID
   - System Program
   - Token Program
   - USDC Mint address
   - Various PDA accounts (authority, token messenger, token minter, etc.)
2. Submit the extension transaction to Fordefi
3. Confirm the ALT is ready for use

**Example output:**
```
=== Step 2: Extend ALT with CCTP Accounts ===

Adding 13 accounts to ALT:

  1. CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC
  2. CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe
  3. 11111111111111111111111111111111
  ...

✅ ALT extension transaction submitted
   Transaction ID: tx_...

🎉 ALT is ready! Update your config.ts:
   altAddress: "7XWz8...abc123"
```

### Step 4: Update Configuration

Update `src/config.ts` with your ALT address:

```typescript
export const bridgeConfigSolana: BridgeConfigSolana = {
  // ... other config ...
  altAddress: "7XWz8...abc123", // Add this line
};
```

### Step 5: Run the Bridge Transaction

Now you can run the bridge transaction with ALT support:

```bash
npm run eth-to-solana
```

The transaction will automatically use the ALT, reducing its size and ensuring it stays within Fordefi's limits.

## Accounts Added to the ALT

The following accounts are added to the ALT during the extend step:

| Account | Type | Description |
|---------|------|-------------|
| `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC` | Program ID | Message Transmitter Program |
| `CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe` | Program ID | Token Messenger Minter Program |
| `11111111111111111111111111111111` | Program ID | System Program |
| `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Program ID | Token Program |
| `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Mint | USDC Mint Address |
| Various PDAs | PDA | messageTransmitterAccount, authorityPda, tokenMessenger, tokenMinter, localToken, feeRecipientTokenAccount, tokenMessengerEventAuthority, custodyTokenAccount |

## Transaction Size Comparison

### Without ALT:
```
Transaction size: ~1350 bytes
Status: ❌ Exceeds Fordefi limit
```

### With ALT:
```
Transaction size: ~934 bytes
Saved: ~416 bytes with ALT
Status: ✅ Within Fordefi limit
```

## Troubleshooting

### Error: "ALT not found"

**Problem:** The ALT hasn't been activated yet or doesn't exist.

**Solution:** 
- Wait 1-2 minutes after creating the ALT
- Verify the ALT exists on Solscan
- Check you're using the correct ALT address

### Error: "Transaction too large"

**Problem:** Transaction still exceeds size limits even with ALT.

**Solution:**
- Verify the ALT was properly extended with all accounts
- Check the ALT contains the expected 13 accounts
- Review the accounts in your instruction to ensure they're all in the ALT

### Error: "Invalid ALT address"

**Problem:** The ALT address in config is incorrect or malformed.

**Solution:**
- Verify you copied the full ALT address from Step 1
- Ensure the address is a valid Solana public key (base58 encoded)
- Check for typos or whitespace in the address

## Advanced: Manual ALT Management

If you need to add additional accounts to your ALT, you can do so programmatically:

```typescript
import { AddressLookupTableProgram, PublicKey } from "@solana/web3.js";

const additionalAccounts = [
  new PublicKey("YourAccount1..."),
  new PublicKey("YourAccount2..."),
];

const extendIx = AddressLookupTableProgram.extendLookupTable({
  payer: payerPubkey,
  authority: authorityPubkey,
  lookupTable: altAddress,
  addresses: additionalAccounts,
});

// Submit via Fordefi...
```

## Notes

- **One-time setup:** You only need to create and extend the ALT once. The same ALT can be used for all future CCTP bridge transactions.
- **Authority:** The vault that creates the ALT is its authority and can extend it with more accounts later.
- **Costs:** Creating and extending an ALT costs a small amount of SOL (~0.01 SOL total).
- **Mainnet vs Devnet:** Use separate ALTs for mainnet and devnet as program IDs may differ.

## Learn More

- [Solana Address Lookup Tables Documentation](https://docs.solana.com/developing/lookup-tables)
- [CCTP on Solana](https://developers.circle.com/stablecoin/docs/cctp-solana-integration)
- [Fordefi Documentation](https://docs.fordefi.com)

