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
} from "@solana/kit";
import {
    findAssociatedTokenPda,
    getCreateAssociatedTokenIdempotentInstructionAsync,
    TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import type { Base64EncodedWireTransaction } from "@solana/transactions";
import { getBatchTransferSameTokenInstruction } from "./src/instructions";
import {
  fordefiConfig,
  SAME_TOKEN_TRANSFERS,
} from "./config";
import { signWithFordefi } from "./fordefi/signers";
import { createClient } from "./fordefi/solana-client-util";

async function main() {
  const token_mint = fordefiConfig.single_token_batch_mint;
  const senderAddress = address(fordefiConfig.originAddress);
  const signer = createNoopSigner(senderAddress);
  console.log("Sender (Fordefi vault):", senderAddress);

  const { rpc } = createClient();

  const [senderAta] = await findAssociatedTokenPda({ owner: senderAddress, tokenProgram: TOKEN_PROGRAM_ADDRESS, mint: token_mint });
  console.log("Sender USDC ATA:", senderAta);

  const createAtaIxs: Instruction[] = [];
  const recipientAtas: Address[] = [];
  for (const transfer of SAME_TOKEN_TRANSFERS) {
    const [ata] = await findAssociatedTokenPda({ owner: transfer.recipient, tokenProgram: TOKEN_PROGRAM_ADDRESS, mint: token_mint });
    recipientAtas.push(ata);
    console.log(`Recipient ${transfer.recipient} ATA: ${ata}`);
    createAtaIxs.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: signer, owner: transfer.recipient, mint: token_mint }));
  }

  const ix = getBatchTransferSameTokenInstruction({
    sender: signer,
    senderTokenAccount: senderAta,
    amounts: SAME_TOKEN_TRANSFERS.map((t) => t.amount),
  });

  const remainingAccounts: AccountMeta[] = recipientAtas.map((ata) => ({
    address: ata,
    role: AccountRole.WRITABLE,
  }));

  const fullIx: Instruction = {
    ...ix,
    accounts: [...(ix.accounts ?? []), ...remainingAccounts],
  };

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayerSigner(signer, msg),
    (msg) => appendTransactionMessageInstructions([...createAtaIxs, fullIx], msg),
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
