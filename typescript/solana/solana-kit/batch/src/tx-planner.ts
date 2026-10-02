import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';
import {
    TOKEN_PROGRAM_ADDRESS,
    findAssociatedTokenPda,
    getTransferCheckedInstruction,
    getCreateAssociatedTokenIdempotentInstruction
} from '@solana-program/token';

// Token-2022. TransferChecked and the idempotent create-ATA instruction are encoded identically for
// both token programs, so the builders above work for either once the program address is overridden.
const TOKEN_2022_PROGRAM_ADDRESS = kit.address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/**
 * The token program that owns a mint is part of the associated token account's seeds and must be
 * passed to every token instruction, so resolve it from the mint itself rather than assuming the
 * classic SPL Token program (USDG, for example, is a Token-2022 mint).
 */
async function getTokenProgramForMint(rpc: kit.Rpc<kit.GetAccountInfoApi>, mint: kit.Address): Promise<kit.Address> {
    const { value } = await rpc.getAccountInfo(mint, { encoding: 'base64' }).send();
    if (!value) {
        throw new Error(`Mint ${mint} not found - check the mint and RPC URL in config.ts`);
    }
    if (value.owner !== TOKEN_PROGRAM_ADDRESS && value.owner !== TOKEN_2022_PROGRAM_ADDRESS) {
        throw new Error(`Mint ${mint} is not owned by a token program (owner: ${value.owner})`);
    }
    return value.owner;
}

async function deriveATA(owner: kit.Address, mint: kit.Address, tokenProgram: kit.Address) {
    const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram });
    return ata;
}

function createAtaInstruction(
    payer: kit.TransactionSigner,
    owner: kit.Address,
    mint: kit.Address,
    ata: kit.Address,
    tokenProgram: kit.Address
) {
    return getCreateAssociatedTokenIdempotentInstruction({
        payer,
        owner,
        mint,
        ata,
        tokenProgram,
    });
}

function transferInstruction(
    fordefiConfig: FordefiSolanaConfig,
    signerVault: kit.TransactionSigner,
    mint: kit.Address,
    source: kit.Address,
    destination: kit.Address,
    tokenProgram: kit.Address
) {
    // TransferChecked rather than Transfer: Token-2022 rejects the unchecked variant on mints with a transfer fee
    return getTransferCheckedInstruction(
      {
        source,
        destination,
        mint,
        authority: signerVault,
        amount:    fordefiConfig.amount,
        decimals:  Number(fordefiConfig.decimals)
      },
      { programAddress: tokenProgram }
    );
}

// our tx plan, a in this case a batch that will execute atomically
// The vault signer is the Fordefi signer from @solana/keychain-fordefi: Kit asks it to sign
// when each planned message is signed, so it must be used everywhere the vault appears as a signer
export async function createTxPlan(
    fordefiConfig: FordefiSolanaConfig,
    signerVault: kit.TransactionSigner,
    rpc: kit.Rpc<kit.GetAccountInfoApi>
) {
    const sourceVault = signerVault.address;
    const destVault = kit.address(fordefiConfig.destAddress);
    const destVault2 = kit.address(fordefiConfig.destAddress2);
    const mint = kit.address(fordefiConfig.mint);
    const tokenProgram = await getTokenProgramForMint(rpc, mint);
    console.debug("Token program", tokenProgram);

    const sourceAta = await deriveATA(sourceVault, mint, tokenProgram);
    console.debug("Source ATA", sourceAta);

    const destAta = await deriveATA(destVault, mint, tokenProgram);
    console.debug("Destination ATA 1", destAta);

    const destAta2 = await deriveATA(destVault2, mint, tokenProgram);
    console.debug("Destination ATA 2", destAta2);

    // Tx instructions
    const ixes: kit.Instruction[] = [];

    // Create destination ATA 1 if it doesn't exist
    ixes.push(createAtaInstruction(signerVault, destVault, mint, destAta, tokenProgram));
    // Adding first tranfer instructions to our batch
    ixes.push(transferInstruction(fordefiConfig, signerVault, mint, sourceAta, destAta, tokenProgram));

    // Create destination ATA 2 if it doesn't exist
    ixes.push(createAtaInstruction(signerVault, destVault2, mint, destAta2, tokenProgram));
    // Adding second tranfer instructions to our batch
    ixes.push(transferInstruction(fordefiConfig, signerVault, mint, sourceAta, destAta2, tokenProgram));

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
