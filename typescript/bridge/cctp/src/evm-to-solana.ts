import "dotenv/config";
import { getProvider } from "./get-provider";
import {signWithApiSigner } from "./signer";
import {createAndSignTx} from './process_tx'
import {
  fordefiConfigFrom,
  bridgeConfigSolana
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
import { arbitrum } from "viem/chains";
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
  AddressLookupTableAccount,
} from "@solana/web3.js";
import bs58 from "bs58";
import { MESSAGE_TRANSMITTER_PROGRAM_ID, TOKEN_MESSENGER_MINTER_PROGRAM_ID, SOLANA_USDC_MINT, SOLANA_DOMAIN, ARBITRUM_DOMAIN, TOKEN_MESSENGER, ARBITRUM_USDC  } from "./config";

/**
 * EVM to Solana CCTP Bridge with Fordefi
 *
 * This script demonstrates bridging USDC from any EVM chain to Solana:
 * 1. Burn USDC on source EVM chain using Fordefi Web3 provider + CCTP contracts directly
 * 2. Wait for Circle attestation
 * 3. Create Solana receiveMessage transaction (serialized for Fordefi remote signer)
 * 4. Submit serialized transaction to Fordefi API
 */

// ============================================================================
// ALT Helper Functions
// ============================================================================

/**
 * Creates an Address Lookup Table for CCTP accounts
 * This reduces transaction size by referencing accounts via indices
 */
async function createCctpAlt(connection: Connection, payer: PublicKey): Promise<PublicKey> {
  console.log("=== Creating Address Lookup Table ===\n");
  
  const recentSlot = await connection.getSlot();
  const [createIx, tableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer,
    payer: payer,
    recentSlot
  });
  
  console.log(`ALT Address: ${tableAddress.toString()}`);
  console.log(`View at: https://solscan.io/account/${tableAddress}\n`);
  
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message();
  
  const tx = new VersionedTransaction(message);
  const serializedTx = Buffer.from(tx.message.serialize()).toString("base64");
  
  // Return the table address - you'll need to submit this transaction via Fordefi
  return tableAddress;
}

/**
 * Extends the ALT with CCTP program accounts
 * These are the read-only accounts that will be referenced in receiveMessage
 */
async function extendCctpAlt(
  connection: Connection,
  payer: PublicKey,
  tableAddress: PublicKey,
  accountsToAdd: PublicKey[]
): Promise<string> {
  console.log(`=== Extending ALT with ${accountsToAdd.length} accounts ===\n`);
  
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
  
  accountsToAdd.forEach(acc => console.log(`  - ${acc.toString()}`));
  console.log();
  
  return serializedTx;
}

/**
 * Gets the read-only CCTP accounts that can be added to the ALT
 */
function getCctpReadOnlyAccounts(): PublicKey[] {
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  
  return [
    MESSAGE_TRANSMITTER_PROGRAM_ID,
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
    SystemProgram.programId,
    TOKEN_PROGRAM_ID,
    SOLANA_USDC_MINT,
  ];
}

// ============================================================================
// Step 1: Burn USDC
// ============================================================================

async function burnUsdcOnEthereum(): Promise<{
  txHash: string;
  message: string;
  messageHash: string;
}> {
  console.log("=== Step 1: Burning USDC on EVM Chain ===\n");

  const fordefiProvider = await getProvider(fordefiConfigFrom);
  if (!fordefiProvider) {
    throw new Error("Failed to initialize Fordefi provider");
  }

  const walletClient = createWalletClient({
    chain: arbitrum,
    transport: custom(fordefiProvider),
  });

  const [fromAddress] = await walletClient.getAddresses();

  console.log(`From: ${fromAddress}`);
  console.log(`Amount: ${bridgeConfigSolana.amountUsdc} USDC`);
  console.log(`To: ${bridgeConfigSolana.solanaRecipientAddress}\n`);

  const solanaAddressBytes = bs58.decode(
    bridgeConfigSolana.solanaRecipientAddress,
  );
  const solanaAddressBytes32 =
    `0x${Buffer.from(solanaAddressBytes).toString("hex").padStart(64, "0")}` as `0x${string}`;

  const amountInSmallestUnit = parseUnits(bridgeConfigSolana.amountUsdc, 6);

  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(fordefiConfigFrom.rpcUrl),
  });

  const usdcBalance = (await publicClient.readContract({
    address: ARBITRUM_USDC as `0x${string}`,
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

  if (usdcBalance < amountInSmallestUnit) {
    throw new Error(
      `Insufficient USDC balance. Have ${Number(usdcBalance) / 1e6} USDC, need ${bridgeConfigSolana.amountUsdc} USDC`,
    );
  }

  const currentAllowance = (await publicClient.readContract({
    address: ARBITRUM_USDC as `0x${string}`,
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
    args: [fromAddress, TOKEN_MESSENGER as `0x${string}`],
  })) as bigint;

  if (currentAllowance < amountInSmallestUnit) {
    console.log("Approving USDC...");
    const approveTxHash = await walletClient.writeContract({
      address: ARBITRUM_USDC as `0x${string}`,
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
      args: [TOKEN_MESSENGER as `0x${string}`, amountInSmallestUnit],
      account: fromAddress,
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
    if (approveReceipt.status !== "success") {
      throw new Error("Approval transaction failed");
    }

    const newAllowance = (await publicClient.readContract({
      address: ARBITRUM_USDC as `0x${string}`,
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
      args: [fromAddress, TOKEN_MESSENGER as `0x${string}`],
    })) as bigint;

    if (newAllowance < amountInSmallestUnit) {
      throw new Error("Allowance still insufficient after approval");
    }

    console.log("Approved\n");
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const useFastTransfer = bridgeConfigSolana.useFastTransfer;
  const minFinalityThreshold = useFastTransfer ? 1000 : 2000;
  const maxFee = useFastTransfer
    ? (amountInSmallestUnit * BigInt(1)) / BigInt(10000)
    : BigInt(0);
  const destinationCaller = "0x" + "0".repeat(64);

  console.log(
    `Mode: ${useFastTransfer ? "Fast (~20s, 0.01% fee)" : "Standard (~15min, free)"}`,
  );

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
      ARBITRUM_USDC as `0x${string}`,
      destinationCaller as `0x${string}`,
      maxFee,
      minFinalityThreshold,
    ],
  });

  const txHash = (await fordefiProvider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: fromAddress,
        to: TOKEN_MESSENGER,
        data: data,
      },
    ],
  })) as `0x${string}`;

  console.log(`Burn tx: ${txHash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  console.log(`Confirmed (block ${receipt.blockNumber})`);
  console.log(`https://etherscan.io/tx/${txHash}\n`);

  const messageSentEventSignature = keccak256(
    Buffer.from("MessageSent(bytes)"),
  );

  const messageSentLog = receipt.logs.find(
    (log) => log.topics[0] === messageSentEventSignature,
  );

  if (!messageSentLog || !messageSentLog.data) {
    throw new Error("MessageSent event not found in transaction receipt");
  }

  const eventData = messageSentLog.data;
  const lengthHex = eventData.slice(66, 130);
  const messageLength = parseInt(lengthHex, 16);
  const messageHex = "0x" + eventData.slice(130, 130 + messageLength * 2);
  const message = messageHex as `0x${string}`;
  const messageHash = keccak256(message);

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
  txHash: string,
): Promise<{ message: string; attestation: string }> {
  console.log("=== Step 2: Waiting for Circle Attestation ===\n");

  const isFastTransfer = bridgeConfigSolana.useFastTransfer;
  const ATTESTATION_API_URL = `https://iris-api.circle.com/v2/messages/${ARBITRUM_DOMAIN}`;
  const MAX_ATTEMPTS = isFastTransfer ? 60 : 240;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const response = await fetch(`${ATTESTATION_API_URL}?transactionHash=${txHash}`);

      if (response.ok) {
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          const messageData = data.messages[0];

          const isAttestationReady =
            messageData.attestation &&
            messageData.attestation !== "PENDING" &&
            messageData.attestation.startsWith("0x");

          if (isAttestationReady) {
            console.log("Attestation received\n");
            return {
              message: messageData.message,
              attestation: messageData.attestation,
            };
          }

          if (i % 12 === 0) {
            const elapsedSeconds = i * 5;
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            const remainingSeconds = elapsedSeconds % 60;
            console.log(`[${elapsedMinutes}m ${remainingSeconds}s] Waiting...`);
          }
        }
      }
    } catch (error) {
      // Silent retry
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const timeoutMinutes = isFastTransfer ? 5 : 20;
  throw new Error(
    `Attestation timeout after ${timeoutMinutes} minutes. Check: ${ATTESTATION_API_URL}?transactionHash=${txHash}`,
  );
}

// ============================================================================
// Step 3: Create Solana receiveMessage Transaction
// ============================================================================

async function createSolanaReceiveMessageTx(
  message: string,
  attestation: string,
  altAddress?: string,
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

  console.log(`Message length: ${messageBytes.length} bytes`);
  console.log(`Attestation length: ${attestationBytes.length} bytes`);
  console.log(`Message (first 32 bytes): ${messageBytes.slice(0, 32).toString("hex")}`);
  console.log(`Attestation (first 32 bytes): ${attestationBytes.slice(0, 32).toString("hex")}\n`);

  // Derive PDA accounts
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

  // Check if recipient USDC token account exists and create instruction if needed
  const recipientAtaInfo = await connection.getAccountInfo(recipientTokenAccount);
  let createAtaInstruction: TransactionInstruction | null = null;

  if (!recipientAtaInfo) {
    console.log(`ℹ️  Recipient USDC token account does not exist: ${recipientTokenAccount.toString()}`);
    console.log(`   Creating ATA instruction...\n`);

    // Create the Associated Token Account instruction
    // This instruction is idempotent - it will succeed even if the account already exists
    createAtaInstruction = new TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: recipientPubkey, isSigner: true, isWritable: true }, // payer
        { pubkey: recipientTokenAccount, isSigner: false, isWritable: true }, // associated token account
        { pubkey: recipientPubkey, isSigner: false, isWritable: false }, // owner
        { pubkey: SOLANA_USDC_MINT, isSigner: false, isWritable: false }, // mint
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token program
      ],
      data: Buffer.from([]), // Empty data for create instruction
    });
  } else {
    console.log(`✓ Recipient USDC token account exists\n`);
  }

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

  // Event authorities (required by #[event_cpi] macro on both programs)
  const [messageTransmitterEventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    MESSAGE_TRANSMITTER_PROGRAM_ID,
  );

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

  // Log all derived accounts for debugging
  console.log("Derived PDAs:");
  console.log(`  Recipient: ${recipientPubkey.toString()}`);
  console.log(`  Message Transmitter: ${messageTransmitterAccount.toString()}`);
  console.log(`  Authority PDA: ${authorityPda.toString()}`);
  console.log(`  Token Messenger: ${tokenMessenger.toString()}`);
  console.log(`  Token Minter: ${tokenMinter.toString()}`);
  console.log(`  Local Token: ${localToken.toString()}`);
  console.log(`  Remote Token Messenger: ${remoteTokenMessenger.toString()}`);
  console.log(`  Recipient Token Account: ${recipientTokenAccount.toString()}`);
  console.log(`  Custody Token Account: ${custodyTokenAccount.toString()}`);
  console.log(`  Token Pair: ${tokenPair.toString()}`);
  console.log(`  Fee Recipient: ${feeRecipientTokenAccount.toString()}`);
  console.log(`  Used Nonce: ${usedNonces.toString()}`);
  console.log(`  Message Transmitter Event Auth: ${messageTransmitterEventAuthority.toString()}`);
  console.log(`  Token Messenger Event Auth: ${tokenMessengerEventAuthority.toString()}\n`);

  // Build instruction data using Anchor format
  // Anchor discriminator for "receive_message" = first 8 bytes of sha256("global:receive_message")
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256");
  hash.update("global:receive_message");
  const discriminator = hash.digest().slice(0, 8);

  // Anchor encodes parameters as: discriminator + borsh-serialized params
  // For receive_message(params: ReceiveMessageParams), we need to serialize:
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
  // Account order must match exactly what the Anchor program expects
  const instruction: TransactionInstruction = {
    programId: MESSAGE_TRANSMITTER_PROGRAM_ID,
    keys: [
      // MessageTransmitter named accounts (8) - these match the Anchor .accounts() call
      { pubkey: recipientPubkey, isSigner: true, isWritable: true }, // payer
      { pubkey: recipientPubkey, isSigner: true, isWritable: false }, // caller
      { pubkey: authorityPda, isSigner: false, isWritable: false }, // authority_pda
      { pubkey: messageTransmitterAccount, isSigner: false, isWritable: false }, // message_transmitter
      { pubkey: usedNonces, isSigner: false, isWritable: true }, // used_nonce
      { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false }, // receiver
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      { pubkey: messageTransmitterEventAuthority, isSigner: false, isWritable: false }, // event_authority (required by #[event_cpi])

      // TokenMessenger remaining accounts (11) - passed to receiver via CPI
      // These must match the order in the official example exactly
      { pubkey: tokenMessenger, isSigner: false, isWritable: false },
      { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false },
      { pubkey: tokenMinter, isSigner: false, isWritable: true },
      { pubkey: localToken, isSigner: false, isWritable: true },
      { pubkey: tokenPair, isSigner: false, isWritable: false },
      { pubkey: feeRecipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: custodyTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: tokenMessengerEventAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // Fetch ALT if provided
  let lookupTables: AddressLookupTableAccount[] = [];
  if (altAddress) {
    console.log(`Using ALT: ${altAddress}`);
    const altAccount = await connection.getAddressLookupTable(
      new PublicKey(altAddress)
    );
    if (altAccount.value) {
      lookupTables = [altAccount.value];
      console.log(`ALT loaded with ${altAccount.value.state.addresses.length} addresses`);
    } else {
      console.warn(`Warning: ALT ${altAddress} not found, proceeding without it`);
    }
  }

  // Create VersionedTransaction with ALT support
  // If ATA needs to be created, add that instruction first
  const instructions: TransactionInstruction[] = [];
  if (createAtaInstruction) {
    instructions.push(createAtaInstruction);
    console.log("✓ Added create ATA instruction to transaction");
  }
  instructions.push(instruction);

  const txMessage = new TransactionMessage({
    payerKey: recipientPubkey,
    recentBlockhash: blockhash,
    instructions: instructions,
  }).compileToV0Message(lookupTables);

  const transaction = new VersionedTransaction(txMessage);
  const serializedTx = transaction.message.serialize();
  const base64EncodedData = Buffer.from(serializedTx).toString("base64");

  console.log(`Transaction size: ${serializedTx.length} bytes`);
  if (altAddress) {
    console.log(`Saved ~${lookupTables[0]?.state.addresses.length * 32} bytes with ALT\n`);
  } else {
    console.log();
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

  const signature = await signWithApiSigner(payload, bridgeConfigSolana.apiPayloadSignKey);
  const response = await createAndSignTx("/api/v1/transactions", bridgeConfigSolana.apiUserToken, signature, timestamp, requestBody);

  console.log("Response:", response.data);
}

// ============================================================================
// Main Function
// ============================================================================

async function main(): Promise<void> {
  try {
    console.log("=== Ethereum → Solana CCTP Bridge ===\n");

    if (!bridgeConfigSolana.solanaRecipientAddress) {
      throw new Error("SOLANA_RECIPIENT_ADDRESS must be set");
    }
    if (!bridgeConfigSolana.fordefiVaultId) {
      throw new Error("FORDEFI_SOLANA_VAULT_ID must be set");
    }

    // Check if ALT is configured
    if (bridgeConfigSolana.altAddress) {
      console.log(`Using ALT: ${bridgeConfigSolana.altAddress}\n`);
    } else {
      console.log("⚠️  No ALT configured. Transaction may be too large.");
      console.log("Run 'npm run setup-alt' to create and extend an ALT first.\n");
    }

    const { txHash, message } = await burnUsdcOnEthereum();
    const { attestation } = await waitForAttestation(txHash);
    const base64SerializedTx = await createSolanaReceiveMessageTx(
      message,
      attestation,
      bridgeConfigSolana.altAddress
    );
    await submitToFordefiApi(base64SerializedTx);

    console.log("\n✅ Bridge completed\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
