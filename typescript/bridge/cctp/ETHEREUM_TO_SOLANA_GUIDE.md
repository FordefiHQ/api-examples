# Ethereum to Solana CCTP Bridge with Fordefi

This guide explains how to bridge USDC from Ethereum to Solana using Circle's CCTP (Cross-Chain Transfer Protocol) with Fordefi as the signing provider.

## Overview

The bridge operates in **four main steps**:

1. **Burn USDC on Ethereum** (Source Chain) - Using Fordefi Web3 Provider
2. **Wait for Circle Attestation** - Poll Circle's attestation API
3. **Create Solana receiveMessage Transaction** - Build and serialize the transaction
4. **Submit to Fordefi API** - Send serialized transaction to Fordefi's remote signer

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Ethereum   │────1───>│    Circle    │────2───>│   Solana    │
│  (Burn)     │         │ (Attestation)│         │   (Mint)    │
└─────────────┘         └──────────────┘         └─────────────┘
       │                                                  │
       │                                                  │
   Fordefi                                           Fordefi
   Web3 Provider                                     Remote Signer
```

## Prerequisites

### Environment Variables

Create a `.env` file with:

```bash
# Fordefi Configuration
FORDEFI_API_USER_TOKEN=your_api_token
FORDEFI_SOLANA_VAULT_ID=your_vault_id

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RECIPIENT_ADDRESS=your_solana_wallet_address

# Optional: Custom RPC endpoints
ETHEREUM_RPC_URL=https://eth.llamarpc.com
```

### Fast vs Standard Transfer

Configure in `src/config.ts`:

```typescript
export const bridgeConfigSolana = {
  // ...
  useFastTransfer: true, // true = fast (20s, 0.01% fee), false = standard (15min, free)
};
```

**Fast Transfer (recommended for most use cases)**:

- **Speed**: ~20 seconds
- **Fee**: 0.01% (1 basis point)
- **Block confirmations**: ~2 blocks
- **Use case**: When speed matters more than saving 0.01%

**Standard Transfer**:

- **Speed**: 13-19 minutes
- **Fee**: FREE
- **Block confirmations**: ~65 blocks (hard finality)
- **Use case**: Large transfers where 0.01% fee is significant

### Solana CCTP Program IDs

**Mainnet & Devnet (Domain 5):**
- MessageTransmitterV2: `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC`
- TokenMessengerMinterV2: `CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe`

## Detailed Flow

### Step 1: Burn USDC on Ethereum

Use Bridge Kit with Fordefi Web3 Provider to burn USDC on Ethereum:

```typescript
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { getProvider } from './get-provider';

const kit = new BridgeKit();
const ethereumProvider = await getProvider(fordefiConfig);

const ethereumAdapter = await createAdapterFromProvider({
  provider: ethereumProvider,
  capabilities: { addressContext: 'user-controlled' }
});

// This will trigger the depositForBurn on Ethereum
const result = await kit.bridge({
  from: {
    adapter: ethereumAdapter,
    chain: 'Ethereum'
  },
  to: {
    chain: 'Solana',
    recipientAddress: 'your-solana-address'
  },
  amount: '10',
});
```

**Important:** Capture the `MessageSent` event from the transaction. This event contains:
- `message`: The CCTP message bytes
- `messageHash`: Used to query Circle's attestation service

### Step 2: Wait for Circle Attestation

**Confirmation Requirements:**

- **Ethereum Mainnet**: ~65 blocks (13-19 minutes for standard messages)
- **Fast Messages**: ~2 blocks (~20 seconds) - for messages with finality threshold ≤1000
- **Standard Messages**: Full finality (~65 blocks) - for messages with finality threshold =2000

Poll Circle's Iris API for attestation:

```typescript
async function waitForAttestation(messageHash: string) {
  const ATTESTATION_API_URL = "https://iris-api.circle.com/v1/attestations";

  const response = await fetch(`${ATTESTATION_API_URL}/${messageHash}`);
  const data = await response.json();

  if (data.status === "complete") {
    return {
      message: data.message,      // Original CCTP message
      attestation: data.attestation // Signed attestation
    };
  }
}
```

**Attestation Timing:**

- **Standard Messages**: 13-19 minutes (requires ~65 block confirmations for hard finality)
- **Fast Messages** (CCTP V2): 8-20 seconds (requires only 2 block confirmations)

By default, this script uses standard messages which prioritize security over speed.

### Step 3: Build Solana receiveMessage Transaction

The `receiveMessage` instruction requires specific accounts and data:

#### Required Accounts (in order)

1. **Payer** - Transaction fee payer (your Solana address) - Signer, Writable
2. **MessageTransmitter** - PDA: `["message_transmitter"]`
3. **TokenMessenger** - PDA: `["token_messenger"]`
4. **RemoteTokenMessenger** - PDA: `["remote_token_messenger", sourceDomainId]`
5. **TokenMinter** - PDA: `["token_minter"]` - Writable
6. **LocalToken** - PDA: `["local_token", usdcMint]` - Writable
7. **TokenPair** - PDA: `["token_pair", sourceDomainId, sourceTokenBytes]`
8. **RecipientTokenAccount** - Your USDC token account - Writable
9. **CustodyTokenAccount** - PDA: `["custody", usdcMint]` - Writable
10. **TokenProgram** - SPL Token Program ID

#### Instruction Data Format

```
[discriminator] + [message_len (u16)] + [message_bytes] + [attestation_bytes]
```

#### Example Transaction Construction

```typescript
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction
} from "@solana/web3.js";

const MESSAGE_TRANSMITTER_ID = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC"
);

const TOKEN_MESSENGER_MINTER_ID = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe"
);

// Parse message bytes
const messageBytes = Buffer.from(message.replace('0x', ''), 'hex');
const attestationBytes = Buffer.from(attestation.replace('0x', ''), 'hex');

// Derive PDAs
const [messageTransmitter] = PublicKey.findProgramAddressSync(
  [Buffer.from("message_transmitter")],
  MESSAGE_TRANSMITTER_ID
);

// ... derive other PDAs (see eth-to-solana.ts for full example)

// Build transaction
const instruction = {
  programId: MESSAGE_TRANSMITTER_ID,
  keys: [/* ... account metas ... */],
  data: instructionData
};

const { blockhash } = await connection.getLatestBlockhash();

const messageV0 = new TransactionMessage({
  payerKey: recipientPubkey,
  recentBlockhash: blockhash,
  instructions: [instruction],
}).compileToV0Message();

const transaction = new VersionedTransaction(messageV0);

// Serialize to base64
const serialized = transaction.message.serialize();
const base64Data = Buffer.from(serialized).toString('base64');
```

### Step 4: Submit to Fordefi API

Send the serialized transaction to Fordefi's transaction endpoint:

```typescript
const fordefiPayload = {
  vault_id: "your-vault-id",
  signer_type: "api_signer",
  sign_mode: "auto",
  type: "solana_transaction",
  details: {
    type: "solana_serialized_transaction_message",
    push_mode: "auto",
    chain: "solana_mainnet",
    data: base64Data  // Base64-encoded transaction message
  }
};

// POST to Fordefi API
const response = await fetch('https://api.fordefi.com/api/v1/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.FORDEFI_API_TOKEN}`
  },
  body: JSON.stringify(fordefiPayload)
});
```

## Using Anchor for Better Type Safety

For production use, consider using Anchor with the official CCTP IDL:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import cctpIdl from "./cctp_idl.json"; // Get from Circle's GitHub

const program = new Program(cctpIdl, MESSAGE_TRANSMITTER_ID, provider);

const tx = await program.methods
  .receiveMessage({
    message: messageBytes,
    attestation: attestationBytes,
  })
  .accounts({
    payer: recipientPubkey,
    messageTransmitter,
    // ... other accounts
  })
  .transaction();

// Serialize and submit to Fordefi
const serialized = tx.serializeMessage();
const base64Data = Buffer.from(serialized).toString('base64');
```

## Message Format

CCTP messages have the following structure:

```
Bytes 0-3:   Version
Bytes 4-7:   Source Domain
Bytes 8-11:  Destination Domain
Bytes 12-19: Nonce
Bytes 20-51: Sender Address
Bytes 52-83: Recipient Address
Bytes 84-87: Destination Caller
Bytes 88+:   Message Body
```

For `depositForBurn`, the message body contains:
- Burn token (source chain token address)
- Mint recipient (Solana token account)
- Amount
- Message sender

## Important Notes

### Security Considerations

1. **Validate Message Hash**: Always verify the attestation corresponds to your burn transaction
2. **Check Recipient**: Ensure the mint recipient in the message matches your intended recipient
3. **Nonce Uniqueness**: Each message can only be processed once per domain pair
4. **Amount Validation**: Verify the amount in the message matches your expected amount

### Common Issues

1. **"Account not found" Error**: Ensure recipient's USDC token account exists before minting
2. **"Invalid attestation" Error**: Wait longer for attestation or check message hash
3. **"Nonce already used" Error**: Message already processed, check if USDC was already minted
4. **"Invalid PDA derivation" Error**: Verify PDA seeds match the expected format

### Manual Attestation Verification

If you need to manually check the attestation status (for debugging or rescue):

```bash
# Check attestation status
curl "https://iris-api.circle.com/v1/attestations/<MESSAGE_HASH>"
```

**Response statuses:**

- `pending_confirmations`: Transaction is confirmed, waiting for block confirmations
- `complete`: Attestation is ready, you can proceed to Solana
- Error "Message hash not found": The message hash is incorrect or transaction not yet confirmed

**Example:**

```bash
curl "https://iris-api.circle.com/v1/attestations/0x00d506aee82fa7b37635086f2f7c29bbb9314d672eb2724c5f2bbe2d61d48553"
```

**Response when complete:**

```json
{
  "attestation": "0x8db690ffc69160f04a4420400c817f7dc420e2128a9f9ce4af34ae824ed0df1c...",
  "status": "complete"
}
```

### Manual Rescue Procedure

If the script fails after the Ethereum burn but before submitting to Solana:

1. **Get the message hash from the Ethereum transaction**:
   - Go to Etherscan: `https://etherscan.io/tx/<TX_HASH>`
   - Find the MessageSent event (log index will vary)
   - Copy the message data (the bytes parameter)
   - Decode it properly (remove offset and length, trim to declared length)
   - Hash it: `keccak256(trimmedMessage)`

2. **Check attestation status**:

   ```bash
   curl "https://iris-api.circle.com/v1/attestations/<MESSAGE_HASH>"
   ```

3. **Wait for attestation** (typically 10-20 seconds on mainnet)

4. **Manually construct Solana transaction**:
   - Use the message and attestation from Circle's API
   - Build the `receiveMessage` transaction with proper PDAs
   - Serialize to base64
   - Submit to Fordefi API

5. **Alternative: Use Circle's SDK**:

   ```typescript
   // If automated rescue is needed
   import { CircleAttestation } from '@circle-fin/attestation-sdk';

   const attestation = await CircleAttestation.fetch(messageHash);
   // Then proceed with Solana transaction
   ```

### Testing

Always test on **Devnet** first:
- Ethereum Sepolia → Solana Devnet
- Use small amounts (1-10 USDC)
- Verify attestation before proceeding to mainnet

## Resources

- [Circle CCTP Documentation](https://developers.circle.com/cctp)
- [Solana CCTP Programs](https://developers.circle.com/cctp/solana-programs)
- [Circle CCTP GitHub](https://github.com/circlefin/solana-cctp-contracts)
- [Bridge Kit Quickstart](https://developers.circle.com/bridge-kit/quickstarts/transfer-usdc-from-ethereum-to-solana)

## Running the Example

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run the bridge script
npm run eth-to-solana
```

## Next Steps

1. Obtain CCTP Anchor IDL from Circle's repository
2. Implement proper error handling and retry logic
3. Add transaction monitoring and status updates
4. Implement amount validation and safety checks
5. Add support for other source chains (Base, Arbitrum, etc.)
