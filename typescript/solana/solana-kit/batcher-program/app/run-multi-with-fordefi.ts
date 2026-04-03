import {
  address,
  createNoopSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  AccountRole,
  type Address,
  type AccountMeta,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
} from "@solana-program/token";
import type { Base64EncodedWireTransaction } from "@solana/transactions";

import { getBatchTransferMultiTokenInstructionDataEncoder } from "./src/instructions";
import { BATCHER_PROGRAM_PROGRAM_ADDRESS } from "./src/programs";
import {
  fordefiConfig,
  MULTI_TOKEN_TRANSFERS,
} from "./config";
import { signWithFordefi } from "./fordefi/signers";
import { createClient } from "./fordefi/solana-client-util";

async function getTokenProgramForMint(rpc: Rpc<SolanaRpcApi>, mint: Address): Promise<Address> {
  const { value } = await rpc.getAccountInfo(mint, { encoding: "base64" }).send();
  if (!value) throw new Error(`Mint account ${mint} not found`);
  return value.owner as Address;
}

async function main() {
  const senderAddress = address(fordefiConfig.originAddress);
  const signer = createNoopSigner(senderAddress);
  console.log("Sender (Fordefi vault):", senderAddress);

  const { rpc } = createClient();

  const createAtaIxs: Instruction[] = [];
  const remainingAccounts: AccountMeta[] = [];
  const amounts: bigint[] = [];

  for (const transfer of MULTI_TOKEN_TRANSFERS) {
    const tokenProgram = await getTokenProgramForMint(rpc, transfer.mint);
    console.log(`Mint ${transfer.mint} -> token program: ${tokenProgram}`);

    const [sourceAta] = await findAssociatedTokenPda({ owner: senderAddress, tokenProgram, mint: transfer.mint });
    const [destAta] = await findAssociatedTokenPda({ owner: transfer.recipient, tokenProgram, mint: transfer.mint });
    console.log(`Transfer: ${sourceAta} -> ${destAta} (${transfer.amount})`);

    // Idempotent: no-op if ATA already exists
    createAtaIxs.push(await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer,
      owner: transfer.recipient,
      mint: transfer.mint,
      tokenProgram,
    }));

    remainingAccounts.push(
      { address: sourceAta, role: AccountRole.WRITABLE },
      { address: destAta, role: AccountRole.WRITABLE },
      { address: transfer.mint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
    );
    amounts.push(transfer.amount);
  }

  const ix: Instruction = {
    programAddress: BATCHER_PROGRAM_PROGRAM_ADDRESS,
    accounts: [
      { address: senderAddress, role: AccountRole.WRITABLE_SIGNER },
      ...remainingAccounts,
    ],
    data: getBatchTransferMultiTokenInstructionDataEncoder().encode({ amounts }),
  };

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayerSigner(signer, msg),
    (msg) => appendTransactionMessageInstructions([...createAtaIxs, ix], msg),
  );

  console.log("Signing transaction via Fordefi...");
  const rawSignedTxBase64 = await signWithFordefi(txMessage, rpc);

  if (fordefiConfig.push_to_custom_url) {
    console.log("Sending signed transaction to network...");
    const signature = await rpc
      .sendTransaction(rawSignedTxBase64 as Base64EncodedWireTransaction, {
        encoding: "base64",
        skipPreflight: false,
        preflightCommitment: "confirmed",
      })
      .send();

    console.log("Transaction signature:", signature);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    console.log("Waiting for confirmation...");
    const { value: statuses } = await rpc.getSignatureStatuses([signature]).send();
    const status = statuses[0];
    if (status?.err) {
      console.error("Transaction failed on-chain:", status.err);
      process.exit(1);
    }
    console.log("Transaction sent successfully.");
  } else {
    console.log("Transaction pushed by Fordefi (push_mode: auto).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
