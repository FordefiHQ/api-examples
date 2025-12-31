import * as kit from '@solana/kit';
import { createClient } from '../utils/solana-client-util';
import { FordefiSolanaConfig, TransferConfig } from './config';
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
  getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';

async function deriveATA(owner: kit.Address, transferConfig: TransferConfig) {
    const [ata] = await findAssociatedTokenPda({
      owner:      owner,
      mint:       kit.address(transferConfig.mint),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    return [ata]
}

function createAtaInstruction(
    payer: kit.TransactionSigner,
    owner: kit.Address,
    mint: kit.Address,
    ata: kit.Address
) {
    return getCreateAssociatedTokenIdempotentInstruction({
        payer,
        owner,
        mint,
        ata,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
}

export async function createTx(fordefiConfig: FordefiSolanaConfig, transferConfig: TransferConfig){
    const solana_client = await createClient();
    const sourceVault = kit.address(fordefiConfig.originAddress);
    const sourceVaultSigner = kit.createNoopSigner(sourceVault);
    const destVault = kit.address(fordefiConfig.destAddress);
    const usdcMint = kit.address(transferConfig.mint);

    const [sourceAta] = await deriveATA(sourceVault, transferConfig);
    console.debug("Source ATA", sourceAta);

    const [destAta] = await deriveATA(destVault, transferConfig);
    console.debug("Destination ATA", destAta);

    // Token transfer ixs
    const ixes: any[] = [];
    // create the ATA if it doesn't exist
    ixes.push(
      createAtaInstruction(
        sourceVaultSigner, 
        destVault, 
        usdcMint, 
        destAta as kit.Address
      )
    );
    ixes.push(
      getTransferCheckedInstruction({
        source:      sourceAta as kit.Address,
        destination: destAta as kit.Address,
        mint:        usdcMint,
        authority:   sourceVault,
        amount:      transferConfig.amount,
        decimals:    Number(transferConfig.decimals)
      })
    );

    const { value: latestBlockhash } = await solana_client.rpc.getLatestBlockhash().send();

    const txMessage = kit.pipe(
      kit.createTransactionMessage({ version: 0 }),
      message => kit.setTransactionMessageFeePayer(sourceVault, message),
      message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      message => kit.appendTransactionMessageInstructions(ixes, message)
    );

    const signedTx = await kit.partiallySignTransactionMessageWithSigners(txMessage);
    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');

    const pushMode = transferConfig.useJito ? "manual" : "auto";
    const jsonBody = {
        "vault_id": fordefiConfig.originVault,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": pushMode,
            "chain": "solana_mainnet",
            "data": base64EncodedData
        }
    };

    return jsonBody
}