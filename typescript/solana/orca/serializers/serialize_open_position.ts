import { openFullRangePositionInstructions } from '@orca-so/whirlpools';
import * as kit from '@solana/kit';
import { FordefiSolanaConfig, OrcaOpenPositionConfig } from '../orca_open_position';

const mainnetRpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');

export async function openPositionWithOrca(fordefiConfig: FordefiSolanaConfig, openPositionConfig: OrcaOpenPositionConfig){

    const whirlpoolAddress = kit.address(openPositionConfig.orcaPool)
    const vaultPubKey = kit.address(fordefiConfig.fordefiSolanaVaultAddress)
    const txSigner = kit.createNoopSigner(vaultPubKey)
    const param = { 
      tokenA: openPositionConfig.tokenAAmount 
    };

    const { quote, instructions, initializationCost, positionMint } = await openFullRangePositionInstructions(
      mainnetRpc,
      whirlpoolAddress,
      param,
      100,
      txSigner
    );

    console.log(`Quote token max B: ${quote.tokenMaxB}`);
    console.log(`Initialization cost: ${initializationCost}`);
    console.log(`Position mint: ${positionMint}`);

    const { value: latestBlockhash } = await mainnetRpc.getLatestBlockhash().send();

    const txMessage = kit.pipe(
        kit.createTransactionMessage({ version: 0 }),
        message => kit.setTransactionMessageFeePayer(vaultPubKey, message),
        message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
        message => kit.appendTransactionMessageInstructions(instructions, message)
      );
    console.log("Tx message: ", txMessage)

    const signedTx = await kit.partiallySignTransactionMessageWithSigners(txMessage)
    console.log("Signed transaction: ", signedTx)

    const signatures = Object.values(signedTx.signatures);
    const secondSignature = signatures[1] ? Buffer.from(signatures[1]).toString('base64') : null;
    console.log("Second signature", secondSignature)
    const thirdSignature = signatures[2] ? Buffer.from(signatures[2]).toString('base64') : null;

    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');

    const pushMode = openPositionConfig.useJito ? "manual" : "auto";
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
              {data: secondSignature},
              {data: thirdSignature}
            ]
        },
        "wait_for_state": "signed" // only for create-and-wait
    };

    return jsonBody

}