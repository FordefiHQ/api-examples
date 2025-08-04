import * as gill from 'gill';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { FordefiSolanaConfig, TransferConfig } from './config';
import { buildTransferTokensTransaction } from "gill/programs/token";


export async function createTx(fordefiConfig: FordefiSolanaConfig, transferConfig: TransferConfig){
    const rpc = gill.createSolanaRpc(transferConfig.mainnetRpc);
    const sourceVault = gill.address(fordefiConfig.originAddress);
    const sourceVaultSigner = gill.createNoopSigner(sourceVault);
    const destVault = gill.address(fordefiConfig.destAddress);
    const usdcMint = gill.address(transferConfig.mint);

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transferTokensTx = await buildTransferTokensTransaction({
      feePayer: sourceVaultSigner,
      latestBlockhash,
      mint: usdcMint,
      authority: sourceVaultSigner,
      amount: transferConfig.amount,
      destination: destVault,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const signedTx = await gill.compileTransaction(transferTokensTx);

    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');
    console.log("Base64-encoded transaction bytes: ", base64EncodedData)

    const jsonBody = {
        vault_id: fordefiConfig.originVault,
        signer_type: "api_signer",
        sign_mode: "auto",
        type: "solana_transaction",
        details: {
            type: "solana_serialized_transaction_message",
            push_mode: "auto",
            chain: "solana_mainnet",
            data: base64EncodedData
        }
    };

    return jsonBody;
}