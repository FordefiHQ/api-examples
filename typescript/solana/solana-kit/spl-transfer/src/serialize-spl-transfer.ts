import * as kit from '@solana/kit';
import { TransferConfig } from './config';
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
  getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';

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

// The vault signer is the Fordefi signer from @solana/keychain-fordefi: Kit asks it to sign
// when the message is signed, so it must be used everywhere the vault appears as a signer
export async function createTxMessage(
    vaultSigner: kit.TransactionSigner,
    rpc: kit.Rpc<kit.GetLatestBlockhashApi & kit.GetAccountInfoApi>,
    destAddress: string,
    transferConfig: TransferConfig
){
    const sourceVault = vaultSigner.address;
    const destVault = kit.address(destAddress);
    const mint = kit.address(transferConfig.mint);
    const tokenProgram = await getTokenProgramForMint(rpc, mint);
    console.debug("Token program", tokenProgram);

    const sourceAta = await deriveATA(sourceVault, mint, tokenProgram);
    console.debug("Source ATA", sourceAta);

    const destAta = await deriveATA(destVault, mint, tokenProgram);
    console.debug("Destination ATA", destAta);

    // Token transfer ixs
    const ixes: kit.Instruction[] = [];
    // create the ATA if it doesn't exist
    ixes.push(
      createAtaInstruction(
        vaultSigner,
        destVault,
        mint,
        destAta,
        tokenProgram
      )
    );
    ixes.push(
      // TransferChecked rather than Transfer: Token-2022 rejects the unchecked variant on mints with a transfer fee
      getTransferCheckedInstruction(
        {
          source:      sourceAta,
          destination: destAta,
          mint,
          authority:   vaultSigner,
          amount:      transferConfig.amount,
          decimals:    Number(transferConfig.decimals)
        },
        { programAddress: tokenProgram }
      )
    );

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    return kit.pipe(
      kit.createTransactionMessage({ version: 0 }),
      message => kit.setTransactionMessageFeePayerSigner(vaultSigner, message),
      message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      message => kit.appendTransactionMessageInstructions(ixes, message)
    );
}
