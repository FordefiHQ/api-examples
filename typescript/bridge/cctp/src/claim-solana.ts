/**
 * Manual CCTP Claim Script for Solana
 * Usage: npm run claim-solana -- --tx-hash 0x123...abc
 */

import "dotenv/config";
import * as fs from "fs";
import {
  bridgeConfigSolana,
  SOLANA_RELAYER_PRIVATE_KEY,
  ARBITRUM_DOMAIN,
  SOLANA_USDC_MINT,
  ARBITRUM_USDC,
} from "./config";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import {
  getProgramsV2,
  getReceiveMessagePdasV2,
  decodeEventNonceFromMessageV2,
} from "../solana-cctp-contracts/examples/v2/utilsV2";

const CIRCLE_ATTESTATION_API = `https://iris-api.circle.com/v2/messages/${ARBITRUM_DOMAIN}`;
const REMOTE_USDC_HEX = ARBITRUM_USDC.toLowerCase();
const ALT_STORAGE_FILE = ".cctp-alt-address.txt";

function parseArgs(): { txHash?: string } {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tx-hash" && args[i + 1]) {
      return { txHash: args[i + 1] };
    }
  }
  return {};
}

function createProviderFromPrivateKey(): anchor.AnchorProvider {
  const connection = new Connection(bridgeConfigSolana.solanaRpcUrl, "confirmed");
  const secretKey = bs58.decode(SOLANA_RELAYER_PRIVATE_KEY);
  const keypair = Keypair.fromSecretKey(secretKey);

  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => {
      if ('version' in tx) {
        (tx as anchor.web3.VersionedTransaction).sign([keypair]);
      } else {
        (tx as anchor.web3.Transaction).partialSign(keypair);
      }
      return tx;
    },
    signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
      return txs.map(tx => {
        if ('version' in tx) {
          (tx as anchor.web3.VersionedTransaction).sign([keypair]);
        } else {
          (tx as anchor.web3.Transaction).partialSign(keypair);
        }
        return tx;
      });
    },
  };

  return new anchor.AnchorProvider(connection, wallet as anchor.Wallet, { commitment: "confirmed" });
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

async function getOrCreateAddressLookupTable(
  connection: Connection,
  payer: Keypair,
  addresses: PublicKey[]
): Promise<AddressLookupTableAccount> {
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
  console.log(`Waiting for ALT activation...`);
  await new Promise((r) => setTimeout(r, 2000));

  const altAccount = await connection.getAddressLookupTable(altPubkey);
  if (!altAccount.value) throw new Error("Failed to fetch created ALT");

  fs.writeFileSync(ALT_STORAGE_FILE, altPubkey.toBase58());
  console.log(`ALT address saved to ${ALT_STORAGE_FILE}\n`);

  return altAccount.value;
}

async function completeMintOnSolana(message: string, attestation: string): Promise<void> {
  console.log(`=== Completing Mint on Solana ===\n`);

  const provider = createProviderFromPrivateKey();
  const connection = provider.connection;
  const payer = Keypair.fromSecretKey(bs58.decode(SOLANA_RELAYER_PRIVATE_KEY));

  const { messageTransmitterProgram, tokenMessengerMinterProgram } = getProgramsV2(provider);

  const recipientPubkey = new PublicKey(bridgeConfigSolana.solanaRecipientAddress);
  const usdcMint = new PublicKey(SOLANA_USDC_MINT);
  const recipientTokenAccount = await getAssociatedTokenAddress(usdcMint, recipientPubkey);

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

  const lookupTable = await getOrCreateAddressLookupTable(connection, payer, altAddresses);

  // V2 handle_receive_unfinalized_message account order
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

async function main(): Promise<void> {
  console.log("=== CCTP Manual Claim for Solana ===\n");

  const { txHash } = parseArgs();

  if (!txHash) {
    console.log("Usage: npm run claim-solana -- --tx-hash <evm-burn-tx-hash>");
    process.exit(1);
  }

  if (!SOLANA_RELAYER_PRIVATE_KEY) {
    throw new Error("PHANTOM_PK environment variable must be set");
  }

  const { message, attestation } = await fetchAttestation(txHash);
  await completeMintOnSolana(message, attestation);
}

main().catch((err) => {
  console.error("\nError:", err.message || err);
  process.exit(1);
});
