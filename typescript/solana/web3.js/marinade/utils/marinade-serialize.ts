import { NativeStakingConfig, NativeStakingSDK } from '@marinade.finance/native-staking-sdk';
import { FordefiSolanaConfig, stakeWithMarinade } from "../config";
import * as web3 from '@solana/web3.js';

const connection = new web3.Connection("https://api.mainnet-beta.solana.com");
const config = new NativeStakingConfig({ connection: connection});
const sdk = new NativeStakingSDK(config);

export async function serializeMarinadeTx(fordefiConfig: FordefiSolanaConfig){  
    const fordefiVaultPubKey = new web3.PublicKey(fordefiConfig.fordefiSolanaVaultAddress);
    const { createAuthorizedStake, stakeKeypair } = sdk.buildCreateAuthorizedStakeInstructions(fordefiVaultPubKey, stakeWithMarinade.solAmount);

    const { blockhash } = await connection.getLatestBlockhash()
    const tx = new web3.VersionedTransaction(new web3.TransactionMessage({
        payerKey: fordefiVaultPubKey,
        recentBlockhash: blockhash,
        instructions: createAuthorizedStake,
    }).compileToV0Message());

    await tx.sign([stakeKeypair])

    const serializedMessage = Buffer.from(
        tx.message.serialize()
    ).toString('base64');

    console.debug("Tx ->", tx)
    let secondSig = tx.signatures[1] ? Buffer.from(tx.signatures[1]).toString('base64') : null
    
    const jsonBody = {
        "vault_id": fordefiConfig.vaultId,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": "auto",
            "data": serializedMessage,
            "chain": "solana_mainnet",            
            "signatures":[
              {data: null}, // -> IMPORTANT this is a placeholder for your Fordefi Solana Vault's signature, this must be {data: null}
              {data: secondSig}
            ]
        },
        "wait_for_state": "signed" // only for create-and-wait
    };

    return jsonBody;
}