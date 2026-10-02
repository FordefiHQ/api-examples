# Solana Gas Station with Fordefi

A TypeScript tool for executing Solana SPL token transfers using multiple vault signatures through the Fordefi API and [Solana Kit](https://www.solanakit.com/). This tool demonstrates a "gas station" pattern where one vault pays transaction fees while another vault provides the tokens.

> [!NOTE]
> **This is a custom fee sponsorship flow.** Fordefi natively supports [fee sponsorship](https://docs.fordefi.com/developers/transaction-types/fees-sponsorship) on Solana, which abstracts away the two-step signing logic implemented manually here. Rather than pinging the API twice — once for the fee payer's partial signature and again for the source vault's — you add a `fee_payer` field to the `details` object of a single transaction request:
>
> ```json
> "fee_payer": {
>     "type": "vault",
>     "vault_id": "<FEE_PAYER_VAULT_ID>"
> }
> ```
>
> Fordefi then covers the fees from that vault on behalf of the origin vault. No setup is required on Solana, and the whole transaction is handled in one API request.
>
> We recommend using the native fee sponsorship flow. This example is useful for understanding what that native flow does under the hood, or if you need to assemble the partially signed message yourself, or if you're using a Waas organization, since Waas organizations don't support native fee sponsorship at the moment.

## Overview

This tool creates a two-step signing process:
1. **Fee Payer Vault**: Signs the transaction to cover network fees
2. **Source Vault**: Signs the transaction to authorize token transfer

The transaction transfers SPL tokens from a source vault to a destination address, with fees paid by a separate fee payer vault.

Because both vaults sign the *same* serialized message, the transaction is built once and then passed through Fordefi twice: the first request returns a partially signed transaction, and the second contributes the remaining signature and broadcasts it.

## Prerequisites

- **Fordefi organization and Solana vaults**: You need access to a Fordefi organization with at least two Solana vaults
- **Node.js and npm installed**: Version 16 or higher recommended
- **Fordefi credentials**: API User token and API Signer set up ([documentation](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker))

## Installation

1. **Navigate to the project directory**:
   ```bash
   cd typescript/solana/solana-kit/gas-station
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Add your private key**: Place your API User's private key in PEM format at `solana-kit/secret/private.pem`, shared by all solana-kit examples (see the [shared setup](../README.md))

## Configuration

Add the following variables to `solana-kit/.env`, shared by all solana-kit examples:

```env
# Fordefi API Configuration
FORDEFI_API_TOKEN=your_fordefi_api_token_here

# Vault Configuration
FORDEFI_VAULT_ID=vault_id_containing_tokens_to_transfer
FORDEFI_VAULT_ADDRESS=public_address_of_vault_holding_tokens

# Destination Configuration  
DESTINATION_ADDRESS=destination_public_address_for_tokens

# Fee Payer Configuration
FEE_PAYER_VAULT_ADDRESS=public_address_of_fee_payer_vault
FEE_PAYER_VAULT_ID=vault_id_that_will_pay_transaction_fees
```

### Configuration Details

- **FORDEFI_API_TOKEN**: Your Fordefi API access token
- **FORDEFI_VAULT_ID**: The vault ID that contains the tokens you want to transfer
- **FORDEFI_VAULT_ADDRESS**: The public address (base58) of the vault holding the tokens
- **DESTINATION_ADDRESS**: The public address where tokens will be sent
- **FEE_PAYER_VAULT_ADDRESS**: The public address of the vault that will pay transaction fees
- **FEE_PAYER_VAULT_ID**: The vault ID that will pay for transaction fees

### Token Configuration

Token and network settings live in `src/config.ts`:

```typescript
rpcUrl: 'https://api.devnet.solana.com',
chain: 'solana_devnet', // must match rpcUrl above: solana_mainnet or solana_devnet
tokenMint: '4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7', // Devnet USDG (Token-2022)
decimals: 6n,
amount: 1_000n, // 1 USDG = 1_000_000n (including decimals)
```

Keep `chain` in step with `rpcUrl` — it tells Fordefi which network to simulate and broadcast on, so a mismatch will fail prediction against the wrong chain. To run on mainnet with USDC instead:

```typescript
rpcUrl: 'https://api.mainnet-beta.solana.com',
chain: 'solana_mainnet',
tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
```

Both classic SPL Token and Token-2022 mints work — the correct token program is detected from the mint itself, so no extra configuration is needed. Make sure `decimals` matches the mint.

## Usage

### Running the Tool

Execute the main script to perform a token transfer:

```bash
npm run gas
# or
npx tsx src/run.ts
```

### What Happens

1. **Transaction Creation**: Builds a legacy SPL token transfer transaction with `@solana/kit`, creating the destination associated token account first if it doesn't already exist
2. **Fee Payer Signing**: Submits the transaction to Fordefi for partial signature by the fee payer vault
3. **Source Vault Signing**: Takes the partially signed transaction and submits it for final signature by the source vault
4. **Transaction Broadcast**: The fully signed transaction is automatically broadcast to the Solana network
5. **Explorer Link**: Provides a Solana Explorer link to view the transaction

### Expected Output

```
Payload signed 🖋️✅ -> [signature]
Submitting transaction to Fordefi for partial signature 🔑
Payload signed 🖋️✅ -> [signature]  
Submitting transaction to Fordefi for 2cd signature 🔑🔑
Transaction fully signed and submitted to network ✅
Final transaction ID: [transaction_id]
https://explorer.solana.com/tx/[transaction_hash]
```

## Project Structure

```
gas-station/
├── src/
│   ├── config.ts           # Fordefi configuration and environment variables
│   ├── run.ts              # Main execution script
│   ├── serialize-spl.ts    # Transaction building and serialization
│   ├── process_tx.ts       # Fordefi API interaction
│   └── signer.ts           # Utilities for signing your transaction with your API User's private key
├── package.json
└── tsconfig.json
```

## Implementation Notes

- The transaction is built as a **legacy** (not versioned) message with a compute unit limit of 31,000 — a bare transfer costs under 10,000 CU, and validating the associated token account on-chain during an idempotent create adds roughly 15,000 CU on top.
- The destination account is created with the **idempotent** create-ATA instruction, which gracefully no-ops if the account already exists.
- Vaults are represented with `createNoopSigner`, since the actual signatures come from Fordefi's MPC rather than a local keypair.
- Before serializing, the source vault's account role in the transfer instruction is upgraded from `READONLY_SIGNER` to `WRITABLE_SIGNER`, since it is a signer distinct from the fee payer.
- The owning **token program is read from the mint account** rather than assumed. The program id is one of the associated token account's seeds and must be passed to every token instruction, so hardcoding the classic SPL Token program derives the wrong ATA and fails with `IncorrectProgramId` on Token-2022 mints.
- Transfers use **`TransferChecked`**, not the unchecked `Transfer`. Token-2022 rejects the unchecked variant on mints carrying the transfer-fee extension, and the checked form additionally guards against a mismatched `decimals` setting.
- Mints with a **transfer hook** program are not supported as written: those require resolving the hook's extra accounts and adding them to the instruction.

## Support

For issues related to:
- **Fordefi API**: Check the [Fordefi documentation](https://docs.fordefi.com/developers/api-overview)
- **Solana transactions**: Refer to [Solana documentation](https://docs.solana.com/)
- **Solana Kit**: Check the [Solana Kit documentation](https://www.solanakit.com/)
