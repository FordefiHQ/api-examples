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

export async function createTx(fordefiConfig: FordefiSolanaConfig){
    const rpc = kit.createSolanaRpc(fordefiConfig.mainnetRpc);
    const rpcSubscriptions = kit.createSolanaRpcSubscriptions(fordefiConfig.ws);
    const sourceVault = kit.address(fordefiConfig.originAddress);
    const destVault = kit.address(fordefiConfig.destAddress);
    const destVault2 = kit.address(fordefiConfig.destAddress2);
    const usdcMint = kit.address(fordefiConfig.mint);
    const signerVault = kit.createNoopSigner(sourceVault)

    const [sourceAta] = await deriveATA(sourceVault, fordefiConfig);
    console.debug("Source ATA", sourceAta); 

    const [destAta] = await deriveATA(destVault, fordefiConfig);
    console.debug("Destination ATA 1", destAta);

    const [destAta2] = await deriveATA(destVault2, fordefiConfig);
    console.debug("Destination ATA 2", destAta2);

    // Token transfer ixs (with ATA creation if needed)
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

    // Create instruction plan - this will auto-split if needed
    const instructionPlan = kit.nonDivisibleSequentialInstructionPlan(ixes);

    const transactionPlanner = kit.createTransactionPlanner({
        createTransactionMessage: () =>{
            const message = kit.pipe(
                kit.createTransactionMessage({ version: 0 }),
                message => kit.setTransactionMessageFeePayerSigner(signerVault, message),
            )
            return message
        }
    });

    const transactionPlan = await transactionPlanner(instructionPlan);

    const sendAndConfirmTransaction = kit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
 
    const transactionPlanExecutor = kit.createTransactionPlanExecutor({
        executeTransactionMessage: async (
            message: kit.BaseTransactionMessage & kit.TransactionMessageWithFeePayer,
        ) => {
            const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
            const messageWithBlockhash = kit.setTransactionMessageLifetimeUsingBlockhash(
                latestBlockhash,
                message,
            );
            const transaction = await signTransactionMessageWithSigners(messageWithBlockhash);
            await sendAndConfirmTransaction(transaction, { commitment: 'confirmed' });
            return { transaction };
        },
    });

    const signedTx = await kit.partiallySignTransactionMessageWithSigners(message);
    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');
    const jsonBodies = {
        "vault_id": fordefiConfig.originVault,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": "auto ",
            "chain": "solana_mainnet",
            "data": base64EncodedData
        },
        "wait_for_state": "signed"
    };

    return jsonBodies
}