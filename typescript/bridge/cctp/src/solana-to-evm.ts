import "dotenv/config";
import { getProvider } from "./get-provider";
import {signWithApiSigner } from "./signer";
import {createAndSignTx, get_tx} from './process_tx'
import {
  fordefiConfigFrom,
  bridgeConfigSolana
} from "./config";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http
} from "viem";
import { arbitrum } from "viem/chains";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as spl from "@solana/spl-token";
import { SOLANA_USDC_MINT, SOLANA_DOMAIN, ARBITRUM_DOMAIN, ARBITRUM_MESSAGE_TRANSMITTER_V2  } from "./config";
import {
  getProgramsV2,
  getDepositForBurnPdasV2
} from "../solana-cctp-contracts/examples/v2/utilsV2";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { getBytes } from "ethers";

// ============================================================================
// Helper: Convert EVM address to bytes32
// ============================================================================

function evmAddressToBytes32(address: string): string {
  // Circle's implementation - prepend zeros to make 32 bytes
  return `0x000000000000000000000000${address.replace("0x", "")}`;
}

// ============================================================================
// Step 1: Burn USDC on Solana (Deposit for Burn)
// ============================================================================

async function burnUsdcOnSolana(
  amount: BN,
  maxFee: BN,
  minFinalityThreshold: number
): Promise<{ base64EncodedData: string; eventAccountSignature: string; messageSentEventData: PublicKey }> {
  console.log("=== Step 1: Deposit for Burn on Solana ===\n");

  const connection = new Connection(
    bridgeConfigSolana.solanaRpcUrl,
    "confirmed",
  );
  
  const ownerPubkey = new PublicKey(
    bridgeConfigSolana.solanaRecipientAddress,
  );

  // Initialize Anchor provider and programs
  const anchorProvider = new anchor.AnchorProvider(
    connection,
    { publicKey: ownerPubkey } as any,
    { commitment: "confirmed" }
  );
  
  const { messageTransmitterProgram, tokenMessengerMinterProgram } =
    getProgramsV2(anchorProvider);

  const usdcAddress = SOLANA_USDC_MINT;
  
  // Derive the ATA for the owner's USDC account (burn token account)
  const userTokenAccount = await getAssociatedTokenAddress(
    usdcAddress,
    ownerPubkey
  );

  // Set destination domain and recipient
  const destinationDomain = ARBITRUM_DOMAIN;
  // For EVM destination, convert EVM address to bytes32 and create a PublicKey from it
  const evmAddressBytes32 = evmAddressToBytes32(bridgeConfigSolana.evmRecipientAddress);
  const mintRecipientBytes = getBytes(evmAddressBytes32);
  const mintRecipient = new PublicKey(mintRecipientBytes);
  const destinationCaller = PublicKey.default;

  // Get PDAs for deposit for burn
  const pdas = getDepositForBurnPdasV2(
    {
      messageTransmitterProgram,
      tokenMessengerMinterProgram,
    },
    usdcAddress,
    destinationDomain
  );

  // Generate a new keypair for the MessageSent event account
  const messageSentEventAccountKeypair = Keypair.generate();

  // Build the depositForBurn instruction using the Anchor program
  const instructionBuilder = tokenMessengerMinterProgram.methods
    .depositForBurn({
      amount,
      destinationDomain,
      mintRecipient,
      maxFee,
      minFinalityThreshold,
      destinationCaller,
    })
    .accounts({
      owner: ownerPubkey,
      eventRentPayer: ownerPubkey,
      senderAuthorityPda: pdas.authorityPda.publicKey,
      burnTokenAccount: userTokenAccount,
      messageTransmitter: pdas.messageTransmitterAccount.publicKey,
      tokenMessenger: pdas.tokenMessengerAccount.publicKey,
      remoteTokenMessenger: pdas.remoteTokenMessengerKey.publicKey,
      tokenMinter: pdas.tokenMinterAccount.publicKey,
      localToken: pdas.localToken.publicKey,
      burnTokenMint: usdcAddress,
      messageSentEventData: messageSentEventAccountKeypair.publicKey,
      messageTransmitterProgram: messageTransmitterProgram.programId,
      tokenMessengerMinterProgram: tokenMessengerMinterProgram.programId,
      tokenProgram: spl.TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([messageSentEventAccountKeypair]);

  const instruction = await instructionBuilder.instruction();

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // Create VersionedTransaction with the instruction
  const instructions: TransactionInstruction[] = [];
  instructions.push(instruction);

  const txMessage = new TransactionMessage({
    payerKey: ownerPubkey,
    recentBlockhash: blockhash,
    instructions: instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(txMessage);
  
  // Sign the transaction locally with the messageSentEventAccountKeypair
  // to get its signature that we'll pass to Fordefi
  transaction.sign([messageSentEventAccountKeypair]);
  
  // Extract the signature from the messageSentEventAccountKeypair
  // The signature array is ordered by the signers in the transaction
  // Index 0: owner/payer (will be signed by Fordefi)
  // Index 1: messageSentEventAccountKeypair (signed locally)
  const eventAccountSignature = transaction.signatures[1];
  
  if (!eventAccountSignature || eventAccountSignature.every(byte => byte === 0)) {
    throw new Error("Failed to sign with messageSentEventAccountKeypair");
  }
  
  // Serialize ONLY the message (not the full transaction)
  const serializedMessage = transaction.message.serialize();
  const base64EncodedMessage = Buffer.from(serializedMessage).toString("base64");
  
  // Convert signature to base64
  const base64Signature = Buffer.from(eventAccountSignature).toString("base64");

  console.log(`Amount: ${amount.toString()} USDC`);
  console.log(`Destination: ${bridgeConfigSolana.evmRecipientAddress} (Arbitrum)\n`);

  return {
    base64EncodedData: base64EncodedMessage,
    eventAccountSignature: base64Signature,
    messageSentEventData: messageSentEventAccountKeypair.publicKey
  };
}

// ============================================================================
// Step 2: Submit to Fordefi API
// ============================================================================

async function submitToFordefiApi(
  base64SerializedMessage: string,
  eventAccountSignature: string
): Promise<string> {
  console.log("=== Step 2: Submitting to Fordefi API ===\n");

  const fordefiApiPayload = {
    vault_id: bridgeConfigSolana.fordefiVaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "solana_transaction",
    details: {
      type: "solana_serialized_transaction_message",
      push_mode: "auto",
      chain: "solana_mainnet",
      data: base64SerializedMessage,
      signatures: [
        { data: null }, // Placeholder for Fordefi vault signature (owner/payer)
        { data: eventAccountSignature }, // Pre-signed by messageSentEventAccountKeypair
      ]
    },
  };

  const requestBody = JSON.stringify(fordefiApiPayload);
  const timestamp = new Date().getTime();
  const payload = `${"/api/v1/transactions"}|${timestamp}|${requestBody}`;

  const signature = await signWithApiSigner(payload, bridgeConfigSolana.apiPayloadSignKey);
  const response = await createAndSignTx("/api/v1/transactions", bridgeConfigSolana.apiUserToken, signature, timestamp, requestBody);

  const transactionId = response.data.id;
  console.log(`Transaction ID: ${transactionId}\n`);

  // Poll Fordefi API to get the transaction hash
  return await waitForTransactionHash(transactionId);
}

async function waitForTransactionHash(transactionId: string): Promise<string> {
  const MAX_ATTEMPTS = 60; // 5 minutes max
  
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const path = `/api/v1/transactions/${transactionId}`;
      const data = await get_tx(path, bridgeConfigSolana.apiUserToken);
      
      // Check multiple possible locations for the transaction hash
      const txHash = 
        data.blockchain_data?.hash ||
        data.blockchain_data?.transaction_hash ||
        data.blockchain_data?.signature ||
        data.tx_hash ||
        data.hash;
      
      if (txHash && data.state === "completed") {
        console.log(`✅ Transaction confirmed: ${txHash}\n`);
        return txHash;
      }
      
      if (data.state === "failed" || data.state === "rejected") {
        throw new Error(`Transaction ${data.state}: ${JSON.stringify(data)}`);
      }

      if (i % 6 === 0) {
        console.log(`[${i * 5}s] Transaction state: ${data.state}...`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error polling transaction: ${errorMsg}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Timeout waiting for transaction confirmation");
}

// ============================================================================
// Step 3: Wait for Circle Attestation
// ============================================================================

async function waitForAttestation(
  txHash: string,
): Promise<{ message: string; attestation: string }> {
  console.log("=== Step 3: Waiting for Circle Attestation ===\n");

  const isFastTransfer = bridgeConfigSolana.useFastTransfer;
  const ATTESTATION_API_URL = `https://iris-api.circle.com/v2/messages/${SOLANA_DOMAIN}`;
  const MAX_ATTEMPTS = isFastTransfer ? 60 : 240;

  console.log(`Using ${isFastTransfer ? "fast" : "standard"} transfer mode\n`);

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const url = `${ATTESTATION_API_URL}?transactionHash=${txHash}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          const messageData = data.messages[0];

          const isAttestationReady =
            messageData.attestation &&
            messageData.attestation !== "PENDING" &&
            messageData.attestation.startsWith("0x");

          if (isAttestationReady) {
            console.log("✅ Attestation received!\n");
            return {
              message: messageData.message,
              attestation: messageData.attestation,
            };
          }

          // Show status even if pending
          if (i % 6 === 0) {
            const elapsedSeconds = i * 5;
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            const remainingSeconds = elapsedSeconds % 60;
            console.log(`[${elapsedMinutes}m ${remainingSeconds}s] Waiting for attestation...`);
          }
        }
      } else {
        if (i % 12 === 0) {
          console.log(`API returned status ${response.status}, continuing to poll...`);
        }
      }
    } catch (error) {
      if (i % 12 === 0) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`Error querying attestation: ${errorMsg}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const timeoutMinutes = isFastTransfer ? 5 : 20;
  throw new Error(
    `Attestation timeout after ${timeoutMinutes} minutes. Check manually: ${ATTESTATION_API_URL}?transactionHash=${txHash}`,
  );
}

// Helper function to decode the mintRecipient from the CCTP message
function decodeMintRecipientFromMessage(message: string): string {
  const messageBytes = message.startsWith('0x') ? message.slice(2) : message;
  
  // Skip to message body (after 116 bytes = 232 hex chars of header)
  const messageBody = messageBytes.substring(232);
  
  // Based on actual message data, the mintRecipient appears at position 136-200 of the message body
  // This corresponds to what would be labeled as the "amount" field in standard parsing
  const mintRecipientField = messageBody.substring(136, 200);
  
  // Extract the last 40 characters (20 bytes) as the Ethereum address
  const address = '0x' + mintRecipientField.slice(-40);
  
  return address;
}

async function receiveMessageOnEvm(
  message: string,
  attestation: string
): Promise<void> {
  console.log("=== Step 4: Receiving Message on Arbitrum ===\n");
  
  // Decode and verify the recipient
  const mintRecipient = decodeMintRecipientFromMessage(message);
  
  if (mintRecipient.toLowerCase() !== bridgeConfigSolana.evmRecipientAddress.toLowerCase()) {
    console.warn(`⚠️  WARNING: Recipient mismatch! Expected: ${bridgeConfigSolana.evmRecipientAddress}, Got: ${mintRecipient}`);
  }
  
  const provider = await getProvider(fordefiConfigFrom);
  if (!provider) {
    throw new Error("Failed to initialize Fordefi provider");
  }

  // MessageTransmitter V2 contract on Arbitrum
  const MESSAGE_TRANSMITTER_ADDRESS = ARBITRUM_MESSAGE_TRANSMITTER_V2;
  
  // MessageTransmitter ABI - just the receiveMessage function
  const MESSAGE_TRANSMITTER_ABI = [
    {
      "inputs": [
        {
          "internalType": "bytes",
          "name": "message",
          "type": "bytes"
        },
        {
          "internalType": "bytes",
          "name": "attestation",
          "type": "bytes"
        }
      ],
      "name": "receiveMessage",
      "outputs": [
        {
          "internalType": "bool",
          "name": "success",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  console.log("Calling receiveMessage...");
  
  // Create wallet client with Fordefi provider
  const walletClient = createWalletClient({
    chain: arbitrum,
    transport: custom(provider),
  });

  const account = fordefiConfigFrom.address as `0x${string}`;

  // Call receiveMessage on the MessageTransmitter contract
  const hash = await walletClient.writeContract({
    address: MESSAGE_TRANSMITTER_ADDRESS,
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: "receiveMessage",
    args: [message, attestation],
    account,
  });

  console.log(`Transaction submitted: ${hash}`);

  // Wait for transaction receipt
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log(`💰 USDC minted to: ${mintRecipient}`);
}

// ============================================================================
// Main Function
// ============================================================================

async function main(): Promise<void> {
  try {
    console.log("=== Solana → EVM CCTP Bridge ===\n");

    if (!bridgeConfigSolana.solanaRecipientAddress) {
      throw new Error("SOLANA_RECIPIENT_ADDRESS must be set");
    }
    if (!bridgeConfigSolana.fordefiVaultId) {
      throw new Error("FORDEFI_SOLANA_VAULT_ID must be set");
    }

    // Configure burn parameters
    // Convert human-readable amount (e.g., "0.1") to smallest unit with 6 decimals
    const amountInSmallestUnit = Math.floor(
      parseFloat(bridgeConfigSolana.amountUsdc) * 1_000_000
    );
    const amount = new BN(amountInSmallestUnit);
    const maxFee = new BN(0); // No fee
    const minFinalityThreshold = 0; // Immediate finality
    
    console.log(`Bridging ${bridgeConfigSolana.amountUsdc} USDC\n`);

    // Step 1: Burn USDC on Solana (Deposit for Burn)
    const { base64EncodedData, eventAccountSignature, messageSentEventData } = await burnUsdcOnSolana(
      amount,
      maxFee,
      minFinalityThreshold
    );

    // Step 2: Submit to Fordefi API and wait for transaction hash
    const txHash = await submitToFordefiApi(base64EncodedData, eventAccountSignature);
    
    // Step 3: Wait for Circle attestation using transaction hash
    const { message, attestation } = await waitForAttestation(txHash);
    
    // Step 4: Receive message on EVM (Arbitrum) to mint USDC
    await receiveMessageOnEvm(message, attestation);
    
    console.log("\n🎉 Bridge completed successfully!");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});