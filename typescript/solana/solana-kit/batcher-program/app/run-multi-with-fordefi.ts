import {
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

import { getBatchTransferMultiTokenInstructionDataEncoder } from "./src/instructions";
import { BATCHER_PROGRAM_PROGRAM_ADDRESS } from "./src/programs";
import {
  fordefiConfig,
  MULTI_TOKEN_TRANSFERS,
} from "./config";
import { createVaultSigner, signAndSendWithFordefi } from "./fordefi/signer";
import { createClient } from "./fordefi/solana-client-util";

async function getTokenProgramForMint(rpc: Rpc<SolanaRpcApi>, mint: Address): Promise<Address> {
  const { value } = await rpc.getAccountInfo(mint, { encoding: "base64" }).send();
  if (!value) throw new Error(`Mint account ${mint} not found`);
  return value.owner as Address;
}

export async function main() {
  const signer = await createVaultSigner();
  const senderAddress = signer.address;
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
