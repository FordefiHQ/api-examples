import "dotenv/config";
import bs58 from "bs58";
import { getProvider } from "./get-provider";
import {
  fordefiConfigFrom,
  bridgeConfigSolana,
  SOLANA_RELAYER_PRIVATE_KEY,
  SOLANA_USDC_MINT
} from "./config";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { createAdapterFromPrivateKey as createSolanaAdapterFromPrivateKey } from "@circle-fin/adapter-solana";

// ============================================================================
// Helper: Ensure Recipient USDC Token Account Exists
// ============================================================================

async function ensureRecipientTokenAccount(
  connection: Connection,
  recipientAddress: string,
  relayerKeypair: Keypair
): Promise<void> {
  console.log("Checking if recipient USDC token account exists...");

  const recipientPubkey = new PublicKey(recipientAddress);
  const usdcMint = new PublicKey(SOLANA_USDC_MINT);

  // Get the recipient's associated token account address
  const recipientTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    recipientPubkey
  );

  console.log(`Recipient USDC account: ${recipientTokenAccount.toBase58()}`);

  // Check if the account exists
  const accountInfo = await connection.getAccountInfo(recipientTokenAccount);

  if (!accountInfo) {
    console.log("⚠️  Token account doesn't exist. Creating it...");

    // Create the associated token account
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        relayerKeypair.publicKey, // payer
        recipientTokenAccount,     // ata
        recipientPubkey,          // owner
        usdcMint                  // mint
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = relayerKeypair.publicKey;
    transaction.sign(relayerKeypair);

    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });

    console.log(`✅ Token account created: ${signature}`);
    console.log(`   https://solscan.io/tx/${signature}\n`);
  } else {
    console.log("✅ Token account already exists\n");
  }
}

// ============================================================================
// Bridge USDC from EVM to Solana using Circle Bridge Kit
// ============================================================================

async function bridgeUsdcEvmToSolana(): Promise<void> {
  console.log("=== EVM → Solana CCTP Bridge (Circle Bridge Kit) ===\n");

  // Initialize Fordefi provider for EVM
  const fordefiProvider = await getProvider(fordefiConfigFrom);
  if (!fordefiProvider) {
    throw new Error("Failed to initialize Fordefi provider");
  }

  // Get the from address for logging
  const fromAddress = await fordefiProvider.request({ method: "eth_accounts" }).then((accounts: any) => accounts[0]);

  console.log(`From: ${fromAddress}`);
  console.log(`To: ${bridgeConfigSolana.solanaRecipientAddress}`);
  console.log(`Amount: ${bridgeConfigSolana.amountUsdc} USDC\n`);

  // Ensure recipient's USDC token account exists on Solana
  const connection = new Connection(bridgeConfigSolana.solanaRpcUrl, "confirmed");
  const relayerKeypair = Keypair.fromSecretKey(bs58.decode(SOLANA_RELAYER_PRIVATE_KEY));
  await ensureRecipientTokenAccount(connection, bridgeConfigSolana.solanaRecipientAddress, relayerKeypair);

  // Initialize Bridge Kit
  const kit = new BridgeKit();

  // Create EVM adapter using Fordefi provider
  const viemAdapter = await createAdapterFromProvider({
    provider: fordefiProvider as any,
  });

  // Create Solana adapter from private key
  const solanaAdapter = createSolanaAdapterFromPrivateKey({
    privateKey: SOLANA_RELAYER_PRIVATE_KEY,
  });

  console.log("Starting bridge transfer...");
  console.log("This will:");
  console.log("1. Burn USDC on Arbitrum");
  console.log("2. Wait for Circle attestation");
  console.log("3. Mint USDC on Solana\n");

  const result = await kit.bridge({
    from: { adapter: viemAdapter, chain: "Arbitrum" },
    to: {
      adapter: solanaAdapter,
      chain: "Solana",
      recipientAddress: bridgeConfigSolana.solanaRecipientAddress 
    },
    amount: bridgeConfigSolana.amountUsdc,
  });

  console.log("\n✅ Bridge operation completed!");
  console.log(`\nBridge state: ${result.state}`);
  console.log(`Amount: ${result.amount} ${result.token}`);
  console.log("\nTransaction details:");

  if (result.steps && result.steps.length > 0) {
    const stepNames = [
      "Approve USDC (if needed)",
      "Burn USDC on Arbitrum",
      "Wait for attestation",
      "Mint USDC on Solana"
    ];

    result.steps.forEach((step: any, index: number) => {
      const stepName = stepNames[index] || `Step ${index + 1}`;
      console.log(`\n${stepName}:`);
      console.log(`  State: ${step.state || 'unknown'}`);
      console.log(`  Name: ${step.name || 'N/A'}`);
      if (step.txHash) {
        console.log(`  Transaction: ${step.txHash}`);
      }
      if (step.explorerUrl) {
        console.log(`  Explorer: ${step.explorerUrl}`);
      }
      if (step.errorMessage) {
        console.log(`  Error: ${step.errorMessage}`);
      }
    });
  }
  if (result.state === 'pending') {
    console.log("\n⚠️  Warning: Bridge is still pending. The mint on Solana may not have completed.");
    console.log("You may need to manually complete the transfer or retry.");
  } else if (result.state === 'error') {
    console.log("\n❌ Error: Bridge failed!");
  } else {
    console.log("\n✅ Bridge completed successfully!");
  }

  console.log("\n");
}

// ============================================================================
// Main Function
// ============================================================================

async function main(): Promise<void> {
  try {
    if (!bridgeConfigSolana.solanaRecipientAddress) {
      throw new Error("SOLANA_RECIPIENT_ADDRESS must be set");
    }

    await bridgeUsdcEvmToSolana();
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
