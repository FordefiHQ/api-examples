import { BN } from 'bn.js'
import DLMM from '@meteora-ag/dlmm'
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import { getJitoTipAccount } from '../utils/get_jito_tip_account'
import { getPriorityFees } from '../utils/get_priority_fees'
import { getCuLimit } from '../utils/get_cu_limit'


const connection = new web3.Connection("https://api.mainnet-beta.solana.com")

async function createDlmm(pool: web3.PublicKey){

    const dlmmPool = DLMM.create(connection, pool); // your pool
    
    return dlmmPool;

}

async function swapQuote(pool: any, swapAmount: typeof BN){

    const swapYtoX = true;
    const binArrays = await pool.getBinArrayForSwap(swapYtoX);
    const swapQuote = await pool.swapQuote(
    swapAmount,
    swapYtoX,
    new BN(10),
    binArrays
    );

    return swapQuote;
}

async function swapIxGetter(pool:any, swapQuote: any, trader: web3.PublicKey, swapAmount: typeof BN){

    // Create swap Tx
    const swapTx = await pool.swap({
        inToken: pool.tokenX.publicKey,
        binArraysPubkey: swapQuote.binArraysPubkey,
        inAmount: swapAmount,
        lbPair: pool.pubkey,
        user: trader,
        minOutAmount: swapQuote.minOutAmount,
        outToken: pool.tokenY.publicKey,
    });

    // return only the instructions
    return swapTx.instructions;
}

async function createJitoInstructions(fordefiSolanaVaultAddress: string, jitoTip: number): Promise<web3.TransactionInstruction[]> {
    // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf")

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip amount -> ${jitoTip}`)

    // Create and return Jito tip instruction
    return [
        web3.SystemProgram.transfer({
            fromPubkey: new web3.PublicKey(fordefiSolanaVaultAddress),
            toPubkey: jitoTipAccount,
            lamports: jitoTip,
        })
    ];
}

export async function createMeteoraSwapTx(vaultId: string, fordefiSolanaVaultAddress: string, swapConfig: any){

    console.log("SwapConfig", swapConfig)

    // Define trader 
    const trader = new web3.PublicKey(fordefiSolanaVaultAddress)

    // Invoke Meteora pool
    const getdlmmPool =  await createDlmm(swapConfig.pool)

    // Get swap quote from Meteora
    const getQuote = await swapQuote(getdlmmPool, swapConfig.swapAmount)
    
    // Get Priority fee
    const priorityFee = await getPriorityFees() // OR set a custom number in lamports

    // Get Meteora-specific swap instructions
    const swapIx =  await swapIxGetter(getdlmmPool, getQuote, trader, swapConfig.swapAmount)

    // Create Tx
    const swapTx = new web3.Transaction()

    // Add instructions to Tx
    if (swapConfig.useJito) {
        const jitoInstructions = await createJitoInstructions(fordefiSolanaVaultAddress, swapConfig.jitoTip)
        swapTx.add(...jitoInstructions)
    }
    swapTx.add(
        web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFee, 
        })
    )
    .add(
        ...swapIx
    )

    // OPTIONAL -> setting CU limit is already handled by the Meteora sdk
    // const cuLimit = await getCuLimit(tippingTx, connection)
    // swapTx
    // .add(
    //     web3.ComputeBudgetProgram.setComputeUnitLimit({
    //         units: targetComputeUnitsAmount ?? 100_000 //
    //     })
    // )

    // Set blockhash + fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    swapTx.recentBlockhash = blockhash;
    swapTx.feePayer = trader;

    // Compile + serialize the swap tx
    const compiledSwapTx = swapTx.compileMessage();
    const serializedV0Message = Buffer.from(
        compiledSwapTx.serialize()
    ).toString('base64');

    // Create JSON
    const pushMode = swapConfig.useJito ? "manual" : "auto";
    const jsonBody = {

        "vault_id": vaultId, // Replace with your vault ID
        "signer_type": "api_signer",
        "sign_mode": "auto", // IMPORTANT
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": pushMode, // IMPORTANT,
            "data": serializedV0Message,  // For legacy transactions, use `serializedLegacyMessage`
            "chain": "solana_mainnet"
        },
        "wait_for_state": "signed" // only for create-and-wait
        
    };

    return jsonBody;
}
