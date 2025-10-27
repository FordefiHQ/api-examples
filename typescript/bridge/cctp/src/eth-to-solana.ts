import "dotenv/config";
import { inspect } from "util";
import { getProvider } from "./get-provider";
import {signWithApiSigner } from "./signer";
import {createAndSignTx} from './process_tx'
import {
  fordefiConfigFrom,
  bridgeConfigSolana,
  BridgeConfigSolana,
} from "./config";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseUnits,
  keccak256,
  encodeFunctionData,
} from "viem";
import { mainnet } from "viem/chains";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Ethereum to Solana CCTP Bridge with Fordefi
 *
 * This script demonstrates bridging USDC from Ethereum to Solana:
 * 1. Burn USDC on Ethereum using Fordefi Web3 provider + CCTP contracts directly
 * 2. Wait for Circle attestation
 * 3. Create Solana receiveMessage transaction (serialized for Fordefi remote signer)
 * 4. Submit serialized transaction to Fordefi API
 */

// ============================================================================
// CCTP Contract Addresses and Program IDs
// ============================================================================

// Ethereum Mainnet CCTP Contracts
// V2 TokenMessenger with Fast Transfer support
const ETHEREUM_TOKEN_MESSENGER = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
const ETHEREUM_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Solana CCTP Program IDs (Mainnet & Devnet)
const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
);
const TOKEN_MESSENGER_MINTER_PROGRAM_ID = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
);
const SOLANA_USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

// CCTP Domain IDs
const SOLANA_DOMAIN = 5;
// ============================================================================
// Step 1: Burn USDC on Ethereum
// ============================================================================

async function burnUsdcOnEthereum(): Promise<{
  txHash: string;
  message: string;
  messageHash: string;
}> {
  console.log("=== Step 1: Burning USDC on Ethereum ===\n");

  // Initialize Fordefi provider
  const fordefiProvider = await getProvider(fordefiConfigFrom);
  if (!fordefiProvider) {
    throw new Error("Failed to initialize Fordefi provider");
  }

  // Create viem wallet client with Fordefi provider
  const walletClient = createWalletClient({
    chain: mainnet,
    transport: custom(fordefiProvider),
  });

  // Get account addresses
  const [fromAddress] = await walletClient.getAddresses();

  console.log(`From address: ${fromAddress}`);
  console.log(
    `Burning ${bridgeConfigSolana.amountUsdc} USDC on ${bridgeConfigSolana.ethereumChain}`,
  );
  console.log(
    `Destination: ${bridgeConfigSolana.solanaRecipientAddress} (Solana)\n`,
  );

  // Convert Solana address to 32-byte hex format
  const solanaAddressBytes = bs58.decode(
    bridgeConfigSolana.solanaRecipientAddress,
  );
  const solanaAddressBytes32 =
    `0x${Buffer.from(solanaAddressBytes).toString("hex").padStart(64, "0")}` as `0x${string}`;

  console.log(
    `Solana address as bytes32: ${solanaAddressBytes32.slice(0, 20)}...\n`,
  );

  const amountInSmallestUnit = parseUnits(bridgeConfigSolana.amountUsdc, 6); // USDC has 6 decimals

  // Check and approve USDC spend if needed
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(fordefiConfigFrom.rpcUrl),
  });

  // Check USDC balance first
  const usdcBalance = (await publicClient.readContract({
    address: ETHEREUM_USDC as `0x${string}`,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [fromAddress],
  })) as bigint;

  console.log(`USDC Balance: ${usdcBalance.toString()} (${Number(usdcBalance) / 1e6} USDC)`);
  console.log(`Amount to burn: ${amountInSmallestUnit.toString()} (${bridgeConfigSolana.amountUsdc} USDC)`);

  if (usdcBalance < amountInSmallestUnit) {
    throw new Error(
      `Insufficient USDC balance. Have ${Number(usdcBalance) / 1e6} USDC, need ${bridgeConfigSolana.amountUsdc} USDC`,
    );
  }
  console.log("✅ Sufficient USDC balance\n");

  const currentAllowance = (await publicClient.readContract({
    address: ETHEREUM_USDC as `0x${string}`,
    abi: [
      {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "allowance",
    args: [fromAddress, ETHEREUM_TOKEN_MESSENGER as `0x${string}`],
  })) as bigint;

  if (currentAllowance < amountInSmallestUnit) {
    console.log("Approving USDC spend...");
    const approveTxHash = await walletClient.writeContract({
      address: ETHEREUM_USDC as `0x${string}`,
      abi: [
        {
          name: "approve",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ],
      functionName: "approve",
      args: [ETHEREUM_TOKEN_MESSENGER as `0x${string}`, amountInSmallestUnit],
      account: fromAddress,
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
    console.log(`✅ USDC approved - Status: ${approveReceipt.status}`);

    if (approveReceipt.status !== "success") {
      throw new Error(`Approval transaction failed with status: ${approveReceipt.status}`);
    }

    // Verify the allowance was actually set
    const newAllowance = (await publicClient.readContract({
      address: ETHEREUM_USDC as `0x${string}`,
      abi: [
        {
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "allowance",
      args: [fromAddress, ETHEREUM_TOKEN_MESSENGER as `0x${string}`],
    })) as bigint;

    console.log(`New allowance: ${newAllowance.toString()} (${Number(newAllowance) / 1e6} USDC)`);

    if (newAllowance < amountInSmallestUnit) {
      throw new Error(`Allowance still insufficient after approval. Have ${Number(newAllowance) / 1e6} USDC, need ${bridgeConfigSolana.amountUsdc} USDC`);
    }

    // Small delay to ensure blockchain state has propagated
    console.log("Waiting 2 seconds for blockchain state propagation...\n");
    await new Promise(resolve => setTimeout(resolve, 2000));
  } else {
    console.log(`✅ Sufficient allowance already exists: ${currentAllowance.toString()}\n`);
  }

  // CCTP V2 parameters for Fast Transfer
  // Fast Transfer: finality 1000, ~20 seconds, 0.01% fee
  // Standard Transfer: finality 2000, ~13-19 minutes, free
  const useFastTransfer = bridgeConfigSolana.useFastTransfer;
  const minFinalityThreshold = useFastTransfer ? 1000 : 2000;
  const maxFee = useFastTransfer
    ? (amountInSmallestUnit * BigInt(1)) / BigInt(10000) // 0.01% for fast transfer
    : BigInt(0); // Free for standard transfer
  const destinationCaller = "0x" + "0".repeat(64); // bytes32(0) = any caller

  console.log(
    `Transfer mode: ${useFastTransfer ? "FAST (20 seconds, 0.01% fee)" : "STANDARD (13-19 minutes, free)"}`,
  );
  console.log(`minFinalityThreshold: ${minFinalityThreshold}`);
  console.log(`maxFee: ${maxFee.toString()} USDC (smallest units)\n`);

  // Call depositForBurn (CCTP V2 with Fast Transfer support)
  console.log("Calling depositForBurn (V2) with parameters:");
  console.log(`  amount: ${amountInSmallestUnit.toString()}`);
  console.log(`  destinationDomain: ${SOLANA_DOMAIN}`);
  console.log(`  mintRecipient: ${solanaAddressBytes32}`);
  console.log(`  burnToken: ${ETHEREUM_USDC}`);
  console.log(`  destinationCaller: ${destinationCaller}`);
  console.log(`  maxFee: ${maxFee.toString()}`);
  console.log(`  minFinalityThreshold: ${minFinalityThreshold}\n`);

  const data = encodeFunctionData({
    abi: [
      {
        name: "depositForBurn",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          { name: "amount", type: "uint256" },
          { name: "destinationDomain", type: "uint32" },
          { name: "mintRecipient", type: "bytes32" },
          { name: "burnToken", type: "address" },
          { name: "destinationCaller", type: "bytes32" },
          { name: "maxFee", type: "uint256" },
          { name: "minFinalityThreshold", type: "uint32" },
        ],
        outputs: [{ type: "uint64" }],
      },
    ],
    functionName: "depositForBurn",
    args: [
      amountInSmallestUnit,
      SOLANA_DOMAIN,
      solanaAddressBytes32,
      ETHEREUM_USDC as `0x${string}`,
      destinationCaller as `0x${string}`,
      maxFee,
      minFinalityThreshold,
    ],
  });

  // Use the Fordefi provider's request method directly
  const txHash = (await fordefiProvider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: fromAddress,
        to: ETHEREUM_TOKEN_MESSENGER,
        data: data,
      },
    ],
  })) as `0x${string}`;

  console.log(`Transaction submitted: ${txHash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  console.log("✅ Transaction confirmed");
  console.log(`   Block number: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`   Status: ${receipt.status === "success" ? "✅ Success" : "❌ Failed"}`);
  console.log(`   View on Etherscan: https://etherscan.io/tx/${txHash}\n`);

  // Extract MessageSent event from logs
  // MessageSent event signature: MessageSent(bytes)
  const messageSentEventSignature = keccak256(
    Buffer.from("MessageSent(bytes)"),
  );

  console.log(
    `Looking for MessageSent event with signature: ${messageSentEventSignature}`,
  );
  console.log(`Found ${receipt.logs.length} logs in transaction\n`);

  const messageSentLog = receipt.logs.find(
    (log) => log.topics[0] === messageSentEventSignature,
  );

  if (!messageSentLog || !messageSentLog.data) {
    console.log("Available log topics:");
    receipt.logs.forEach((log, i) => {
      console.log(`  Log ${i}: ${log.topics[0]}`);
    });
    throw new Error("MessageSent event not found in transaction receipt");
  }

  // Decode the message from the event data
  // The data field contains ABI-encoded bytes: offset (32 bytes) + length (32 bytes) + data
  const eventData = messageSentLog.data;

  console.log(`Raw event data length: ${eventData.length} chars`);
  console.log(`Raw event data: ${eventData.slice(0, 100)}...`);

  // ABI decoding for bytes:
  // First 32 bytes (64 hex chars after 0x) = offset to data start (should be 0x20 = 32)
  const offsetHex = eventData.slice(2, 66);
  console.log(`Offset: 0x${offsetHex}`);

  // Next 32 bytes = length of the message
  const lengthHex = eventData.slice(66, 130);
  const messageLength = parseInt(lengthHex, 16);
  console.log(`Message length from ABI: ${messageLength} bytes`);

  // Extract exactly messageLength bytes (no padding)
  const messageHex = "0x" + eventData.slice(130, 130 + messageLength * 2);
  const message = messageHex as `0x${string}`;
  const messageHash = keccak256(message);

  console.log(`Message: ${message.slice(0, 66)}...`);
  console.log(`Message hash: ${messageHash}\n`);

  return {
    txHash,
    message,
    messageHash,
  };
}

// ============================================================================
// Step 2: Wait for Circle Attestation
// ============================================================================

async function waitForAttestation(
  messageHash: string,
  txHash: string,
): Promise<{ message: string; attestation: string }> {
  console.log("=== Step 2: Waiting for Circle Attestation ===\n");
  console.log(`Message hash: ${messageHash}`);
  console.log(`Transaction hash: ${txHash}`);

  const isFastTransfer = bridgeConfigSolana.useFastTransfer;

  if (isFastTransfer) {
    console.log(
      "\n✨ Fast Transfer Mode: ~1000 block finality (~20 seconds)",
    );
    console.log("Fee: 0.01% of transfer amount\n");
  } else {
    console.log(
      "\n⏱️  Standard Transfer Mode: ~2000 block finality (13-19 minutes)",
    );
    console.log("Fee: FREE\n");
  }

  // CCTP V2 uses a different API endpoint - query by transaction hash
  const ETHEREUM_DOMAIN = 0; // Ethereum mainnet domain ID
  const ATTESTATION_API_URL = `https://iris-api.circle.com/v2/messages/${ETHEREUM_DOMAIN}`;
  const MAX_ATTEMPTS = isFastTransfer ? 60 : 240; // 5 minutes for fast, 20 minutes for standard

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      // V2 API uses transaction hash as query parameter
      const response = await fetch(`${ATTESTATION_API_URL}?transactionHash=${txHash}`);

      // Log response status for debugging
      if (i === 0) {
        console.log(`Attestation API URL: ${ATTESTATION_API_URL}?transactionHash=${txHash}`);
        console.log(`Initial response status: ${response.status}\n`);
      }

      if (response.ok) {
        const data = await response.json();

        // Log the full response on first attempt and periodically for debugging
        if (i === 0 || i % 12 === 0) {
          console.log(`[Attempt ${i + 1}/${MAX_ATTEMPTS}] Response:`, JSON.stringify(data, null, 2));
        }

        // V2 API returns an array of messages
        if (data.messages && data.messages.length > 0) {
          const messageData = data.messages[0]; // Get the first (and should be only) message

          // Check if attestation is ready - it's a hex string when complete, "PENDING" when not
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

          // Show progress every 12 attempts (1 minute) or on first few attempts
          if (i % 12 === 0 || i < 5) {
            const elapsedSeconds = i * 5;
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            const remainingSeconds = elapsedSeconds % 60;
            const status = messageData.status || messageData.attestation || "pending";
            console.log(
              `[${elapsedMinutes}m ${remainingSeconds}s] Status: ${status}`,
            );
          }
        } else {
          // No messages found yet
          if (i < 5) {
            console.log(`[Attempt ${i + 1}] No messages found yet, waiting...`);
          }
        }
      } else {
        // Log non-OK responses for debugging
        const errorText = await response.text();
        if (i === 0 || i % 12 === 0) {
          console.log(
            `[Attempt ${i + 1}] Response ${response.status}: ${errorText.slice(0, 200)}`,
          );
        }
      }
    } catch (error) {
      if (i === 0 || i % 12 === 0) {
        console.error(`[Attempt ${i + 1}] Error fetching attestation:`, error);
      }
    }

    // Wait 5 seconds before next attempt
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const timeoutMinutes = isFastTransfer ? 5 : 20;
  console.error(`\n❌ Attestation timeout after ${timeoutMinutes} minutes\n`);
  console.error(`Troubleshooting steps:`);
  console.error(`1. Check Circle's attestation API: ${ATTESTATION_API_URL}?transactionHash=${txHash}`);
  console.error(`2. Verify the message hash is correct: ${messageHash}`);
  console.error(`3. Check if the transaction was successful on Etherscan: https://etherscan.io/tx/${txHash}`);
  console.error(`4. For fast transfers, ensure finality threshold of 1000 is met`);
  console.error(`5. For standard transfers, ensure finality threshold of 2000 is met\n`);

  throw new Error(
    `Attestation timeout: Message not attested after ${timeoutMinutes} minutes. ` +
      "Check the troubleshooting steps above.",
  );
}

// ============================================================================
// Step 3: Create Solana receiveMessage Transaction
// ============================================================================

async function createSolanaReceiveMessageTx(
  message: string,
  attestation: string,
): Promise<string> {
  console.log("=== Step 3: Creating Solana receiveMessage Transaction ===\n");

  const connection = new Connection(
    bridgeConfigSolana.solanaRpcUrl,
    "confirmed",
  );
  const recipientPubkey = new PublicKey(
    bridgeConfigSolana.solanaRecipientAddress,
  );

  // Parse the message to extract necessary information
  const messageBytes = Buffer.from(message.replace("0x", ""), "hex");
  const attestationBytes = Buffer.from(attestation.replace("0x", ""), "hex");

  // Derive PDA accounts
  const [messageTransmitterAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("message_transmitter")],
    MESSAGE_TRANSMITTER_PROGRAM_ID,
  );

  const [authorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("message_transmitter_authority"), messageTransmitterAccount.toBuffer()],
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

  // Extract source domain from message (bytes 4-7, big endian)
  const sourceDomain = messageBytes.readUInt32BE(4);
  const sourceDomainBuffer = Buffer.alloc(4);
  sourceDomainBuffer.writeUInt32LE(sourceDomain);

  const [remoteTokenMessenger] = PublicKey.findProgramAddressSync(
    [Buffer.from("remote_token_messenger"), sourceDomainBuffer],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  // Get recipient's USDC token account (ATA)
  const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  );
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  );

  const [recipientTokenAccount] = PublicKey.findProgramAddressSync(
    [
      recipientPubkey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      SOLANA_USDC_MINT.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const [custodyTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("custody"), SOLANA_USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  // For tokenPair, we need the source token address from the message
  // Extract from message body (this is simplified - you may need to parse the full message)
  const sourceTokenBytes = messageBytes.slice(88, 120); // Burn token address from message body

  const [tokenPair] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_pair"), sourceDomainBuffer, sourceTokenBytes],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  // Fee recipient token account (V2 feature)
  const [feeRecipientTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_recipient_token_account"), SOLANA_USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  // Token messenger event authority
  const [tokenMessengerEventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  );

  // Derive used nonce PDA (note: singular "used_nonce" per the working example)
  // Extract the full 32-byte nonce from the message (bytes 12-43)
  const nonceBytes = messageBytes.slice(12, 44); // 32 bytes for V2

  const [usedNonces] = PublicKey.findProgramAddressSync(
    [Buffer.from("used_nonce"), nonceBytes],
    MESSAGE_TRANSMITTER_PROGRAM_ID,
  );

  // Build instruction data using Anchor format
  // Anchor discriminator for "receiveMessage" = first 8 bytes of sha256("global:receiveMessage")
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256");
  hash.update("global:receiveMessage");
  const discriminator = hash.digest().slice(0, 8);

  // Anchor encodes parameters as: discriminator + borsh-serialized params
  // For receiveMessage(params: ReceiveMessageParams), we need to serialize:
  // struct ReceiveMessageParams { message: Vec<u8>, attestation: Vec<u8> }

  // Borsh encoding for Vec<u8>: length (u32 LE) + data
  const messageLen = Buffer.alloc(4);
  messageLen.writeUInt32LE(messageBytes.length);

  const attestationLen = Buffer.alloc(4);
  attestationLen.writeUInt32LE(attestationBytes.length);

  const instructionData = Buffer.concat([
    discriminator,
    messageLen,
    messageBytes,
    attestationLen,
    attestationBytes,
  ]);

  // Create the receiveMessage instruction
  // Based on the official Circle CCTP V2 example (examples/v2/solana.ts)
  // Note: Solana deduplicates accounts by pubkey, so duplicate pubkeys won't increase size
  const instruction: TransactionInstruction = {
    programId: MESSAGE_TRANSMITTER_PROGRAM_ID,
    keys: [
      // Named accounts (from the Anchor IDL)
      { pubkey: recipientPubkey, isSigner: true, isWritable: true }, // payer
      { pubkey: recipientPubkey, isSigner: true, isWritable: false }, // caller (deduplicated by Solana)
      { pubkey: authorityPda, isSigner: false, isWritable: false }, // authority_pda
      { pubkey: messageTransmitterAccount, isSigner: false, isWritable: false }, // message_transmitter
      { pubkey: usedNonces, isSigner: false, isWritable: true }, // used_nonces
      { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false }, // receiver
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program

      // Remaining accounts for deposit-for-burn message handling (V2 order)
      // These match the working Arbitrum->Solana example exactly
      { pubkey: tokenMessenger, isSigner: false, isWritable: false },
      { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false },
      { pubkey: tokenMinter, isSigner: false, isWritable: true }, // writable!
      { pubkey: localToken, isSigner: false, isWritable: true }, // writable!
      { pubkey: tokenPair, isSigner: false, isWritable: false },
      { pubkey: feeRecipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: custodyTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: tokenMessengerEventAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false }, // deduplicated
    ],
    data: instructionData,
  };

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // Use legacy Transaction instead of VersionedTransaction for better size optimization
  const transaction = new Transaction({
    feePayer: recipientPubkey,
    recentBlockhash: blockhash,
  });

  transaction.add(instruction);

  // Serialize the transaction message (unsigned)
  // Using legacy transaction serialize() which is more compact
  const serializedTx = transaction.serializeMessage();
  const base64EncodedData = Buffer.from(serializedTx).toString("base64");

  console.log("✅ Transaction serialized to base64");
  console.log(`Serialized transaction size: ${serializedTx.length} bytes`);
  console.log(`Base64 encoded length: ${base64EncodedData.length} characters`);
  console.log(`Message size: ${messageBytes.length} bytes`);
  console.log(`Attestation size: ${attestationBytes.length} bytes`);
  console.log(`Instruction data size: ${instructionData.length} bytes`);
  console.log(`Number of accounts: ${instruction.keys.length}`);

  // Check if transaction is too large for Fordefi (limit is 1232 bytes raw)
  if (serializedTx.length > 1232) {
    console.warn(`\n⚠️  WARNING: Transaction size (${serializedTx.length} bytes) exceeds Fordefi limit (1232 bytes)`);
    console.warn(`   This is due to the large CCTP message and attestation data.`);
    console.warn(`   Attempting to submit anyway...\n`);
  } else {
    console.log(`✅ Transaction size OK (${serializedTx.length} / 1232 bytes)\n`);
  }

  return base64EncodedData;
}

// ============================================================================
// Step 4: Submit to Fordefi API
// ============================================================================

async function submitToFordefiApi(base64SerializedTx: string): Promise<void> {
  console.log("=== Step 4: Submitting to Fordefi API ===\n");

  const fordefiApiPayload = {
    vault_id: bridgeConfigSolana.fordefiVaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "solana_transaction",
    details: {
      type: "solana_serialized_transaction_message",
      push_mode: "auto",
      chain: "solana_mainnet",
      data: base64SerializedTx
    },
  };

  const requestBody = JSON.stringify(fordefiApiPayload);
  const timestamp = new Date().getTime();
  const payload = `${"/api/v1/transactions"}|${timestamp}|${requestBody}`;

  try {
    // Send tx payload to API Signer for signature
    const signature = await signWithApiSigner(payload, bridgeConfigSolana.apiPayloadSignKey);

    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx("/api/v1/transactions", bridgeConfigSolana.apiUserToken, signature, timestamp, requestBody);
    const data = response.data;
    console.log(data)

    console.log("Fordefi API payload:");
    console.log(inspect(fordefiApiPayload, false, 2, true));

    console.log();
  } catch (error) {
    console.error("Error submitting to Fordefi API:", error);
    throw error;
  }
}

// ============================================================================
// Main Function
// ============================================================================

async function main(): Promise<void> {
  try {
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║  Ethereum → Solana CCTP Bridge with Fordefi          ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // Validate configuration
    if (!bridgeConfigSolana.solanaRecipientAddress) {
      throw new Error(
        "SOLANA_RECIPIENT_ADDRESS must be set in environment variables",
      );
    }
    if (!bridgeConfigSolana.fordefiVaultId) {
      throw new Error(
        "FORDEFI_SOLANA_VAULT_ID must be set in environment variables",
      );
    }

    // Step 1: Burn USDC on Ethereum
    const { txHash, message, messageHash } = await burnUsdcOnEthereum();
    console.log(`✅ Burn transaction: ${txHash}\n`);

    // Step 2: Wait for attestation
    const { attestation } = await waitForAttestation(messageHash, txHash);

    // Step 3: Create and serialize Solana transaction
    const base64SerializedTx = await createSolanaReceiveMessageTx(
      message,
      attestation,
    );

    // Step 4: Submit to Fordefi API
    await submitToFordefiApi(base64SerializedTx);

    console.log("\n✅ Bridge flow completed successfully!");
    console.log(
      "\nThe serialized Solana transaction is ready to be signed by Fordefi.",
    );
  } catch (error) {
    console.error("\n❌ ERROR:", inspect(error, false, null, true));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", inspect(err, false, null, true));
  process.exit(1);
});
