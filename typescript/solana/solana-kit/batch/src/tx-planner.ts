import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';
import {
    TOKEN_PROGRAM_ADDRESS,
    findAssociatedTokenPda,
    getTransferCheckedInstruction,
    getCreateAssociatedTokenIdempotentInstruction
} from '@solana-program/token';

async function deriveATA(owner: kit.Address, fordefiConfig: FordefiSolanaConfig) {
    const [ata] = await findAssociatedTokenPda({
      owner:      owner,
      mint:       kit.address(fordefiConfig.mint),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    return [ata]
}

// our tx plan, a in this case a batch that will execute atomically
export async function createTxPlan(fordefiConfig: FordefiSolanaConfig) {
    const sourceVault = kit.address(fordefiConfig.originAddress);
    const destVault = kit.address(fordefiConfig.destAddress);
    const destVault2 = kit.address(fordefiConfig.destAddress2);
    const usdcMint = kit.address(fordefiConfig.mint);
    const signerVault = kit.createNoopSigner(sourceVault);

    const [sourceAta] = await deriveATA(sourceVault, fordefiConfig);
    console.debug("Source ATA", sourceAta);

    const [destAta] = await deriveATA(destVault, fordefiConfig);
    console.debug("Destination ATA 1", destAta);

    const [destAta2] = await deriveATA(destVault2, fordefiConfig);
    console.debug("Destination ATA 2", destAta2);

    // Tx instructions
    const ixes: any = [];

    // Create destination ATA 1 if it doesn't exist
    ixes.push(
      getCreateAssociatedTokenIdempotentInstruction({
        payer: signerVault,
        owner: destVault,
        mint: usdcMint,
        ata: destAta!,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      })
    );

    ixes.push(
      getTransferCheckedInstruction({
        source:      sourceAta!,
        destination: destAta!,
        mint:        usdcMint,
        authority:   sourceVault,
        amount:      fordefiConfig.amount,
        decimals:    Number(fordefiConfig.decimals)
      })
    );

    // Create destination ATA 2 if it doesn't exist
    ixes.push(
      getCreateAssociatedTokenIdempotentInstruction({
        payer: signerVault,
        owner: destVault2,
        mint: usdcMint,
        ata: destAta2!,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      })
    );

    ixes.push(
      getTransferCheckedInstruction({
        source:      sourceAta!,
        destination: destAta2!,
        mint:        usdcMint,
        authority:   sourceVault,
        amount:      fordefiConfig.amount,
        decimals:    Number(fordefiConfig.decimals)
      })
    );

    // create instruction plan - this will auto-split if needed
    const instructionPlan = kit.nonDivisibleSequentialInstructionPlan(ixes);

    // note we don't add a blockhash yet, we'll add it when signing with Fordefi
    const transactionPlanner = kit.createTransactionPlanner({
        createTransactionMessage: () =>
            kit.pipe(
                kit.createTransactionMessage({ version: 0 }),
                msg => kit.setTransactionMessageFeePayerSigner(signerVault, msg),
            ),
    });

    const transactionPlan = await transactionPlanner(instructionPlan);

    return transactionPlan;
}
