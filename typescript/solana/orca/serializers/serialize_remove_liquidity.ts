import { setWhirlpoolsConfig, decreaseLiquidityInstructions } from '@orca-so/whirlpools';
import * as kit from '@solana/kit';
import { FordefiSolanaConfig, OrcaRemoveLiquidityConfig } from '../orca_remove_liquidity';

const mainnetRpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');

export async function removeLiquidityWithOrca(fordefiConfig: FordefiSolanaConfig, removeLiquidityConfig: OrcaRemoveLiquidityConfig){

    await setWhirlpoolsConfig('solanaMainnet');

    const positionNFTMint = kit.address(removeLiquidityConfig.positionMint)
    const vaultPubKey = kit.address(fordefiConfig.fordefiSolanaVaultAddress)
    const txSigner = kit.createNoopSigner(vaultPubKey)
    const param = { 
      tokenA: removeLiquidityConfig.tokenAAmount 
    };

    const { quote: decreaseQuote, instructions: decreaseInstructions } = await decreaseLiquidityInstructions(
      mainnetRpc,
      positionNFTMint,
      param,
      100,
      txSigner
  );
    
    console.log(`Decrease quote token max B: ${decreaseQuote.tokenEstB}`);
    console.log(`Decrease instructions: ${decreaseInstructions}`)

    const { value: latestBlockhash } = await mainnetRpc.getLatestBlockhash().send();

    const txMessage = kit.pipe(
        kit.createTransactionMessage({ version: 0 }),
        message => kit.setTransactionMessageFeePayer(vaultPubKey, message),
        message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
        message => kit.appendTransactionMessageInstructions(decreaseInstructions, message)
      );
    console.log("Tx message: ", txMessage)

    const signedTx = await kit.partiallySignTransactionMessageWithSigners(txMessage)
    console.log("Signed transaction: ", signedTx)

    const signatures = Object.values(signedTx.signatures);
    const secondSignature = signatures[1] ? Buffer.from(signatures[1]).toString('base64') : null;
    console.log("Second signature", secondSignature)

    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');

    const pushMode = removeLiquidityConfig.useJito ? "manual" : "auto";
    const jsonBody = {
        "vault_id": fordefiConfig.vaultId,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": pushMode,
            "chain": "solana_mainnet",
            "data": base64EncodedData,
            "signatures":[
              {data: null}, // -> IMPORTANT this is a placeholder for your Fordefi Solana Vault's signature, this must be {data: null}
              {data: secondSignature}
            ]
        },
        "wait_for_state": "signed" // only for create-and-wait
    };

    return jsonBody

}