import "dotenv/config";
import * as fs from "fs";
import bs58 from "bs58";
import { getProvider } from "./get-provider";
import {
  fordefiConfigFrom,
  bridgeConfigSolana,
  SOLANA_RELAYER_PRIVATE_KEY,
  SOLANA_USDC_MINT,
  ARBITRUM_DOMAIN,
  SOLANA_DOMAIN,
  TOKEN_MESSENGER,
  ARBITRUM_USDC,
} from "./config";
import { parseUnits, pad, toHex, encodeFunctionData } from "viem";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import {
  getProgramsV2,
  getReceiveMessagePdasV2,
  decodeEventNonceFromMessageV2,
} from "../solana-cctp-contracts/examples/v2/utilsV2";

const CIRCLE_ATTESTATION_API = `https://iris-api.circle.com/v2/messages/${ARBITRUM_DOMAIN}`;
const REMOTE_USDC_HEX = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831".toLowerCase();
const ALT_STORAGE_FILE = ".cctp-alt-address.txt";

function getKeypair(): Keypair {
  const secretKey = bs58.decode(SOLANA_RELAYER_PRIVATE_KEY);
  return Keypair.fromSecretKey(secretKey);
}

async function ensureTokenAccountExists(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  payer: Keypair,
  label: string
): Promise<PublicKey> {
  const ata = await spl.getAssociatedTokenAddress(mint, owner);
  console.log(`${label} USDC account: ${ata.toBase58()}`);

  const accountInfo = await connection.getAccountInfo(ata);

  if (!accountInfo) {
    console.log(`  Creating ${label.toLowerCase()} token account...`);

    const createAtaIx = spl.createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      ata,
      owner,
      mint
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [createAtaIx],
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign([payer]);

    const sig = await connection.sendTransaction(tx);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

    console.log(`  Created: https://solscan.io/tx/${sig}\n`);
  } else {
    console.log(`  Token account exists\n`);
  }

  return ata;
}

const TOKEN_MESSENGER_ABI = [
  {
    name: "depositForBurn",
    type: "function",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [{ name: "nonce", type: "uint64" }],
  },
] as const;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function solanaAddressToBytes32(solanaAddress: string): `0x${string}` {
  const pubkey = new PublicKey(solanaAddress);
  return pad(toHex(pubkey.toBytes()), { size: 32 });
}

async function waitForTransaction(provider: any, txHash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    if (receipt) {
      if (receipt.status === "0x1") return;
      throw new Error(`Transaction failed: ${txHash}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Transaction not confirmed: ${txHash}`);
}

async function burnOnEvm(provider: any, fromAddress: string): Promise<string> {
  console.log("=== Burning USDC on EVM ===\n");

  const amount = parseUnits(bridgeConfigSolana.amountUsdc, 6);

  const recipientWallet = new PublicKey(bridgeConfigSolana.solanaRecipientAddress);
  const usdcMint = new PublicKey(SOLANA_USDC_MINT);
  const recipientAta = await spl.getAssociatedTokenAddress(usdcMint, recipientWallet);
  const mintRecipient = solanaAddressToBytes32(recipientAta.toBase58());

  console.log(`Recipient wallet: ${recipientWallet.toBase58()}`);
  console.log(`Recipient ATA (mintRecipient): ${recipientAta.toBase58()}\n`);

  console.log("Approving USDC spend...");
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [TOKEN_MESSENGER as `0x${string}`, amount],
  });

  const approveTxHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: fromAddress,
      to: ARBITRUM_USDC,
      data: approveData,
      gas: "0x20000",
    }],
  });

  console.log(`  Approve TX: https://arbiscan.io/tx/${approveTxHash}`);
  await waitForTransaction(provider, approveTxHash);
  console.log("  Approved!\n");

  console.log("Burning USDC via CCTP V2...");

  const destinationCaller = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  const maxFee = bridgeConfigSolana.useFastTransfer
    ? BigInt(Math.min(Number(amount) / 10, 100000))
    : 0n;

  const minFinalityThreshold = bridgeConfigSolana.useFastTransfer ? 1 : 1000;

  const burnData = encodeFunctionData({
    abi: TOKEN_MESSENGER_ABI,
    functionName: "depositForBurn",
    args: [amount, SOLANA_DOMAIN, mintRecipient, ARBITRUM_USDC as `0x${string}`, destinationCaller, maxFee, minFinalityThreshold],
  });

  const burnTxHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: fromAddress,
      to: TOKEN_MESSENGER,
      data: burnData,
      gas: "0x50000",
    }],
  });

  console.log(`  Burn TX: https://arbiscan.io/tx/${burnTxHash}`);
  await waitForTransaction(provider, burnTxHash);
  console.log("  Burned!\n");

  return burnTxHash;
}

async function fetchAttestation(txHash: string): Promise<{ attestation: string; message: string }> {
  console.log(`Fetching attestation from Circle...`);
  const MAX_ATTEMPTS = 60;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const url = `${CIRCLE_ATTESTATION_API}?transactionHash=${txHash}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.messages?.[0]?.attestation?.startsWith("0x")) {
          console.log(`Attestation received (attempt ${attempt + 1})\n`);
          return {
            attestation: data.messages[0].attestation,
            message: data.messages[0].message,
          };
        }
        if (attempt % 6 === 0) {
          process.stdout.write(`\r  Waiting for attestation...`);
        }
      }
    } catch {
      if (attempt % 12 === 0) {
        process.stdout.write(`\r  Retry ${attempt + 1}/${MAX_ATTEMPTS}...`);
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("\nAttestation not available after 5 minutes");
}

function createAnchorProvider(connection: Connection, payer: Keypair): anchor.AnchorProvider {
  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => {
      if ('version' in tx) {
        (tx as anchor.web3.VersionedTransaction).sign([payer]);
      } else {
        (tx as anchor.web3.Transaction).partialSign(payer);
      }
      return tx;
    },
    signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
      return txs.map(tx => {
        if ('version' in tx) {
          (tx as anchor.web3.VersionedTransaction).sign([payer]);
        } else {
          (tx as anchor.web3.Transaction).partialSign(payer);
        }
        return tx;
      });
    },
  };

  return new anchor.AnchorProvider(connection, wallet as anchor.Wallet, { commitment: "confirmed" });
}

async function getOrCreateALT(connection: Connection, payer: Keypair, addresses: PublicKey[]) {
  try {
    if (fs.existsSync(ALT_STORAGE_FILE)) {
      const storedAddress = fs.readFileSync(ALT_STORAGE_FILE, "utf8").trim();
      const altAddress = new PublicKey(storedAddress);
      const altAccount = await connection.getAddressLookupTable(altAddress);
      if (altAccount.value?.state.addresses.length) {
        console.log(`Using existing ALT: ${altAddress.toBase58()}`);
        return altAccount.value;
      }
    }
  } catch {}

  console.log(`Creating new Address Lookup Table...`);
  const slot = await connection.getSlot();

  const [createIx, altPubkey] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot - 1,
  });

  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: altPubkey,
    addresses,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx, extendIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer]);

  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

  console.log(`ALT created: ${altPubkey.toBase58()}`);
  console.log(`TX: https://solscan.io/tx/${sig}`);
  await new Promise((r) => setTimeout(r, 2000));

  const altAccount = await connection.getAddressLookupTable(altPubkey);
  if (!altAccount.value) throw new Error("Failed to fetch created ALT");

  fs.writeFileSync(ALT_STORAGE_FILE, altPubkey.toBase58());
  console.log(`ALT address saved\n`);

  return altAccount.value;
}

async function claimOnSolana(connection: Connection, payer: Keypair, message: string, attestation: string): Promise<void> {
  console.log(`=== Claiming on Solana ===\n`);

  const provider = createAnchorProvider(connection, payer);
  const { messageTransmitterProgram, tokenMessengerMinterProgram } = getProgramsV2(provider);

  const recipientPubkey = new PublicKey(bridgeConfigSolana.solanaRecipientAddress);
  const usdcMint = new PublicKey(SOLANA_USDC_MINT);
  const recipientTokenAccount = await spl.getAssociatedTokenAddress(usdcMint, recipientPubkey);

  console.log(`Recipient: ${recipientPubkey.toBase58()}`);
  console.log(`Token Account: ${recipientTokenAccount.toBase58()}`);

  const nonce = decodeEventNonceFromMessageV2(message);
  const pdas = await getReceiveMessagePdasV2(
    { messageTransmitterProgram, tokenMessengerMinterProgram },
    usdcMint,
    REMOTE_USDC_HEX,
    String(ARBITRUM_DOMAIN),
    nonce
  );

  const altAddresses = [
    pdas.messageTransmitterAccount.publicKey,
    pdas.tokenMessengerAccount.publicKey,
    pdas.remoteTokenMessengerKey.publicKey,
    pdas.tokenMinterAccount.publicKey,
    pdas.localToken.publicKey,
    pdas.tokenPair.publicKey,
    pdas.feeRecipientTokenAccount,
    recipientTokenAccount,
    pdas.custodyTokenAccount.publicKey,
    spl.TOKEN_PROGRAM_ID,
    pdas.tokenMessengerEventAuthority.publicKey,
    tokenMessengerMinterProgram.programId,
    messageTransmitterProgram.programId,
    SystemProgram.programId,
    pdas.usedNonce,
  ];

  const lookupTable = await getOrCreateALT(connection, payer, altAddresses);

  const accountMetas: anchor.web3.AccountMeta[] = [
    { isSigner: false, isWritable: false, pubkey: pdas.tokenMessengerAccount.publicKey },
    { isSigner: false, isWritable: false, pubkey: pdas.remoteTokenMessengerKey.publicKey },
    { isSigner: false, isWritable: true, pubkey: pdas.tokenMinterAccount.publicKey },
    { isSigner: false, isWritable: true, pubkey: pdas.localToken.publicKey },
    { isSigner: false, isWritable: false, pubkey: pdas.tokenPair.publicKey },
    { isSigner: false, isWritable: true, pubkey: pdas.feeRecipientTokenAccount },
    { isSigner: false, isWritable: true, pubkey: recipientTokenAccount },
    { isSigner: false, isWritable: true, pubkey: pdas.custodyTokenAccount.publicKey },
    { isSigner: false, isWritable: false, pubkey: spl.TOKEN_PROGRAM_ID },
    { isSigner: false, isWritable: false, pubkey: pdas.tokenMessengerEventAuthority.publicKey },
    { isSigner: false, isWritable: false, pubkey: tokenMessengerMinterProgram.programId },
  ];

  console.log(`Building receiveMessage transaction...\n`);

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

  try {
    const receiveMessageIx = await messageTransmitterProgram.methods
      .receiveMessage({
        message: Buffer.from(message.replace("0x", ""), "hex"),
        attestation: Buffer.from(attestation.replace("0x", ""), "hex"),
      })
      .accounts({
        payer: payer.publicKey,
        caller: payer.publicKey,
        messageTransmitter: pdas.messageTransmitterAccount.publicKey,
        usedNonce: pdas.usedNonce,
        receiver: tokenMessengerMinterProgram.programId,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(accountMetas)
      .instruction();

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, receiveMessageIx],
    }).compileToV0Message([lookupTable]);

    const tx = new VersionedTransaction(messageV0);
    tx.sign([payer]);

    console.log(`Transaction size: ${tx.serialize().length} bytes (limit: 1232)`);

    const sig = await connection.sendTransaction(tx);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

    console.log(`\n✅ Mint successful!`);
    console.log(`TX: https://solscan.io/tx/${sig}`);
  } catch (error: any) {
    console.error(`\n❌ receiveMessage failed:`);
    if (error.logs) {
      console.error("Program logs:", error.logs.slice(-10).join("\n"));
    }
    throw error;
  }
}

async function bridgeUsdcEvmToSolana(): Promise<void> {
  console.log("=== EVM -> Solana CCTP Bridge ===\n");

  const fordefiProvider = await getProvider(fordefiConfigFrom);
  if (!fordefiProvider) {
    throw new Error("Failed to initialize Fordefi provider");
  }

  const fromAddress = await fordefiProvider
    .request({ method: "eth_accounts" })
    .then((accounts: any) => accounts[0]);

  console.log(`From: ${fromAddress}`);
  console.log(`To: ${bridgeConfigSolana.solanaRecipientAddress}`);
  console.log(`Amount: ${bridgeConfigSolana.amountUsdc} USDC\n`);

  const connection = new Connection(bridgeConfigSolana.solanaRpcUrl, "confirmed");
  const payer = getKeypair();
  const usdcMint = new PublicKey(SOLANA_USDC_MINT);

  const balance = await connection.getBalance(payer.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log(`Relayer wallet: ${payer.publicKey.toBase58()}`);
  console.log(`Relayer SOL balance: ${balanceSol.toFixed(4)} SOL`);

  if (balance < 10_000_000) {
    console.warn("  Warning: Low SOL balance.\n");
  } else {
    console.log("  Sufficient SOL\n");
  }

  await ensureTokenAccountExists(connection, payer.publicKey, usdcMint, payer, "Relayer");

  const recipientPubkey = new PublicKey(bridgeConfigSolana.solanaRecipientAddress);
  await ensureTokenAccountExists(connection, recipientPubkey, usdcMint, payer, "Recipient");

  console.log(`Starting bridge transfer...`);
  console.log("1. Burn USDC on Arbitrum");
  console.log("2. Wait for Circle attestation");
  console.log("3. Mint USDC on Solana\n");

  const burnTxHash = await burnOnEvm(fordefiProvider, fromAddress);
  const { message, attestation } = await fetchAttestation(burnTxHash);
  await claimOnSolana(connection, payer, message, attestation);

  const amount = parseFloat(bridgeConfigSolana.amountUsdc).toFixed(2);
  console.log(`\n✅ Bridge complete: ${amount} USDC transferred to Solana`);
}

async function main(): Promise<void> {
  if (!bridgeConfigSolana.solanaRecipientAddress) {
    throw new Error("SOLANA_RECIPIENT_ADDRESS must be set");
  }
  if (!SOLANA_RELAYER_PRIVATE_KEY) {
    throw new Error("PHANTOM_PK environment variable must be set");
  }
  await bridgeUsdcEvmToSolana();
}

main().catch((err) => {
  console.error("\nError:", err.message || err);
  process.exit(1);
});
