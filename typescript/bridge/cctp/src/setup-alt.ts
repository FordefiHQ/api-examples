import "dotenv/config";
import { signWithApiSigner } from "./signer";
import { createAndSignTx } from './process_tx';
import { bridgeConfigSolana } from "./config";
import {
  Connection,
  PublicKey,
  SystemProgram,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Setup script for Address Lookup Table (ALT)
 * 
 * This script helps you create and extend an ALT for CCTP bridge transactions.
 * Run this script BEFORE doing your first bridge transaction.
 * 
 * Steps:
 * 1. Create ALT (run with action=create)
 * 2. Wait ~1-2 minutes for ALT to activate
 * 3. Extend ALT with CCTP accounts (run with action=extend)
 * 4. Update config.ts with the ALT address
 * 5. Run the bridge transaction
 */

// CCTP Program IDs
const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
);
const TOKEN_MESSENGER_MINTER_PROGRAM_ID = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
);
const SOLANA_USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

/**
 * Gets the CCTP accounts that should be added to the ALT
 * These are mostly read-only program IDs and common accounts
 */
function getCctpAltAccounts(): PublicKey[] {
  // Derive common PDA accounts
  const [messageTransmitterAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("message_transmitter")],
    MESSAGE_TRANSMITTER_PROGRAM_ID,
  );

  const [authorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("message_transmitter_authority"), TOKEN_MESSENGER_MINTER_PROGRAM_ID.toBuffer()],
    MESSAGE_TRANSMITTER_PROGRAM_ID,
  );

  const [tokenMessenger] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_messenger")],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  const [tokenMinter] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_minter")],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  const [localToken] = PublicKey.findProgramAddressSync(
    [Buffer.from("local_token"), SOLANA_USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  const [feeRecipientTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_recipient_token_account"), SOLANA_USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  const [tokenMessengerEventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  const [custodyTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("custody"), SOLANA_USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  // Return all accounts that can be added to ALT
  // These are mostly read-only accounts that appear in every CCTP receiveMessage transaction
  // Note: messageTransmitterEventAuthority is NOT included as it's not in the instruction accounts
  return [
    MESSAGE_TRANSMITTER_PROGRAM_ID,
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
    SystemProgram.programId,
    TOKEN_PROGRAM_ID,
    SOLANA_USDC_MINT,
    messageTransmitterAccount,
    authorityPda,
    tokenMessenger,
    tokenMinter,
    localToken,
    feeRecipientTokenAccount,
    tokenMessengerEventAuthority,
    custodyTokenAccount,
  ];
}

/**
 * Step 1: Create Address Lookup Table
 */
async function createAlt(): Promise<void> {
  console.log("=== Step 1: Create Address Lookup Table ===\n");

  const connection = new Connection(bridgeConfigSolana.solanaRpcUrl, "confirmed");
  const payer = new PublicKey(bridgeConfigSolana.solanaRecipientAddress);

  const recentSlot = await connection.getSlot();
  const [createIx, tableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer,
    payer: payer,
    recentSlot
  });

  console.log(`📍 ALT Address: ${tableAddress.toString()}`);
  console.log(`   View at: https://solscan.io/account/${tableAddress}\n`);

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  const serializedTx = Buffer.from(tx.message.serialize()).toString("base64");

  // Submit to Fordefi
  const fordefiApiPayload = {
    vault_id: bridgeConfigSolana.fordefiVaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "solana_transaction",
    details: {
      type: "solana_serialized_transaction_message",
      push_mode: "auto",
      chain: bridgeConfigSolana.solanaChain,
      data: serializedTx
    },
  };

  const requestBody = JSON.stringify(fordefiApiPayload);
  const timestamp = new Date().getTime();
  const payload = `${"/api/v1/transactions"}|${timestamp}|${requestBody}`;

  const signature = await signWithApiSigner(payload, bridgeConfigSolana.apiPayloadSignKey);
  const response = await createAndSignTx("/api/v1/transactions", bridgeConfigSolana.apiUserToken, signature, timestamp, requestBody);

  console.log("✅ ALT creation transaction submitted");
  console.log(`   Transaction ID: ${response.data.id}\n`);
  console.log("⏳ Wait 1-2 minutes for the ALT to activate, then run:");
  console.log(`   export ALT_ADDRESS=${tableAddress.toString()}`);
  console.log(`   npm run extend-alt\n`);
}

/**
 * Step 2: Extend ALT with CCTP accounts
 */
async function extendAlt(altAddress: string): Promise<void> {
  console.log("=== Step 2: Extend ALT with CCTP Accounts ===\n");

  const connection = new Connection(bridgeConfigSolana.solanaRpcUrl, "confirmed");
  const payer = new PublicKey(bridgeConfigSolana.solanaRecipientAddress);
  const tableAddress = new PublicKey(altAddress);

  // Get accounts to add
  const accountsToAdd = getCctpAltAccounts();
  
  console.log(`Adding ${accountsToAdd.length} accounts to ALT:\n`);
  accountsToAdd.forEach((acc, i) => {
    console.log(`  ${i + 1}. ${acc.toString()}`);
  });
  console.log();

  // Create extend instruction
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer,
    authority: payer,
    lookupTable: tableAddress,
    addresses: accountsToAdd,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [extendIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  const serializedTx = Buffer.from(tx.message.serialize()).toString("base64");

  // Submit to Fordefi
  const fordefiApiPayload = {
    vault_id: bridgeConfigSolana.fordefiVaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "solana_transaction",
    details: {
      type: "solana_serialized_transaction_message",
      push_mode: "auto",
      chain: bridgeConfigSolana.solanaChain,
      data: serializedTx
    },
  };

  const requestBody = JSON.stringify(fordefiApiPayload);
  const timestamp = new Date().getTime();
  const payload = `${"/api/v1/transactions"}|${timestamp}|${requestBody}`;

  const signature = await signWithApiSigner(payload, bridgeConfigSolana.apiPayloadSignKey);
  const response = await createAndSignTx("/api/v1/transactions", bridgeConfigSolana.apiUserToken, signature, timestamp, requestBody);

  console.log("✅ ALT extension transaction submitted");
  console.log(`   Transaction ID: ${response.data.id}\n`);
  console.log("🎉 ALT is ready! Update your config.ts:");
  console.log(`   altAddress: "${altAddress}"\n`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    const action = process.env.ALT_ACTION || "create";
    const altAddress = process.env.ALT_ADDRESS;

    if (action === "create") {
      await createAlt();
    } else if (action === "extend") {
      if (!altAddress) {
        throw new Error("ALT_ADDRESS environment variable must be set for extend action");
      }
      await extendAlt(altAddress);
    } else {
      throw new Error(`Invalid action: ${action}. Use 'create' or 'extend'`);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

