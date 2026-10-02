import {
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
import { getBatchTransferSameTokenInstruction } from "./src/instructions";
import {
  fordefiConfig,
  SAME_TOKEN_TRANSFERS,
} from "./config";
import { createVaultSigner, signAndSendWithFordefi } from "./fordefi/signer";
import { createClient } from "./fordefi/solana-client-util";

export async function main() {
  const token_mint = fordefiConfig.single_token_batch_mint;
  const signer = await createVaultSigner();
  const senderAddress = signer.address;
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
  const signature = await signAndSendWithFordefi(txMessage, rpc);
  const cluster = fordefiConfig.chain === "solana_devnet" ? "?cluster=devnet" : "";
  console.log(`Explorer: https://explorer.solana.com/tx/${signature}${cluster}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
