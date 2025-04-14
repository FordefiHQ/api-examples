import { setWhirlpoolsConfig, harvestPositionInstructions } from '@orca-so/whirlpools';
import * as kit from '@solana/kit';
import { FordefiSolanaConfig, OrcaHarvestPositionConfig } from '../orca_harvest_position';

const mainnetRpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');

export async function harvestPositionWithOrca(fordefiConfig: FordefiSolanaConfig, harvestPositionConfig: OrcaHarvestPositionConfig){

    await setWhirlpoolsConfig('solanaMainnet');

    const positionNFTMint = kit.address(harvestPositionConfig.positionMint)
    const vaultPubKey = kit.address(fordefiConfig.fordefiSolanaVaultAddress)
    const txSigner = kit.createNoopSigner(vaultPubKey)

    const { feesQuote, rewardsQuote, instructions } = await harvestPositionInstructions(
      mainnetRpc,
      positionNFTMint,
      txSigner
    );
    
    console.log(`Fees owed token A: ${feesQuote.feeOwedA}`);
    console.log(`Rewards '1' owed: ${rewardsQuote.rewards[0].rewardsOwed}`);
    console.log(`Instructions: ${instructions}`)

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

    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');

    const pushMode = harvestPositionConfig.useJito ? "manual" : "auto";
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
            ]
        },
        "wait_for_state": "signed" // only for create-and-wait
    };

    return jsonBody

}