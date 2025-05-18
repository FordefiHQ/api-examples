import * as kit from '@solana/kit';
import { FordefiSolanaConfig, TransferConfig } from './tx-spl'
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getTransferCheckedInstruction } from '@solana-program/token';

export async function createTx(fordefiConfig: FordefiSolanaConfig, transferConfig: TransferConfig){
    const mainnetRpc = kit.createSolanaRpc(transferConfig.mainnetRpc);
    const sourceVault = kit.address(fordefiConfig.originAddress);
    const destVault = kit.address(fordefiConfig.destAddress);
    const usdcMint = kit.address(transferConfig.mint);

    const [sourceAta] = await findAssociatedTokenPda({
      owner:      sourceVault,
      mint:       usdcMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.debug("Source ATA", sourceAta)  
    
    const [destAta] = await findAssociatedTokenPda({
      owner:        destVault,
      mint:         usdcMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.debug("Destination ATA", destAta)

    // Token transfer ixs
    const ixes: any = [];
    ixes.push(
      getTransferCheckedInstruction({
        source:      sourceAta,
        destination: destAta,
        mint:        usdcMint,
        authority:   sourceVault,       
        amount:      transferConfig.amount,
        decimals:    Number(transferConfig.decimals)
      })
    );

    const { value: latestBlockhash } = await mainnetRpc.getLatestBlockhash().send();

    const txMessage = kit.pipe(
      kit.createTransactionMessage({ version: 0 }),
      message => kit.setTransactionMessageFeePayer(sourceVault, message),
      message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      message => {
        return kit.appendTransactionMessageInstruction(ixes[0], message);
      }
    );
    console.log("Tx message: ", txMessage)
    console.log("Tx instructions detailed:", JSON.stringify(txMessage.instructions, null, 2));

    const signedTx = await kit.partiallySignTransactionMessageWithSigners(txMessage)
    console.log("Signed transaction: ", signedTx)

    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');
    console.debug("Raw data ->", base64EncodedData)

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
        },
        "wait_for_state": "signed" // only use this field for create-and-wait
    };

    return jsonBody;
}