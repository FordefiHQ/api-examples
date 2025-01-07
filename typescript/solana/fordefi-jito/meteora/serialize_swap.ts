import fs from 'fs'
import { BN } from 'bn.js'
import DLMM from '@meteora-ag/dlmm'
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import { getJitoTipAccount } from '../utils/get_jito_tip_account'
import { getPriorityFees } from '../utils/get_priority_fees'
import { getCuLimit } from '../utils/get_cu_limit'
import dotenv from 'dotenv'

////// TO CONFIGURE //////
dotenv.config()
const QUICKNODE_KEY = process.env.QUICKNODE_MAINNET_KEY
const VAULT_ID = process.env.VAULT_ID
const FORDEFI_SOLANA_ADDRESS = process.env.FORDEFI_SOLANA_ADDRESS
const connection = new web3.Connection(`${QUICKNODE_KEY}`)
const SOL_USDC_POOL = new web3.PublicKey('BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh') // info can be fetched from block explorer'
const TRADER = new web3.PublicKey(`${FORDEFI_SOLANA_ADDRESS}`)
const JITO_TIP = 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)
const SWAP_AMOUNT = new BN(100);
////// TO CONFIGURE //////

async function createDlmm(){

    const dlmmPool = DLMM.create(connection, SOL_USDC_POOL); // your pool
    
    return dlmmPool

}

async function swapQuote(pool: any){

    const swapYtoX = true;
    const binArrays = await pool.getBinArrayForSwap(swapYtoX);
    const swapQuote = await pool.swapQuote(
    SWAP_AMOUNT,
    swapYtoX,
    new BN(10),
    binArrays
    );

    return swapQuote
}

async function swapIxGetter(pool:any, swapQuote: any, TRADER: web3.PublicKey){

    // Create swap Tx
    const swapTx = await pool.swap({
        inToken: pool.tokenX.publicKey,
        binArraysPubkey: swapQuote.binArraysPubkey,
        inAmount: SWAP_AMOUNT,
        lbPair: pool.pubkey,
        user: TRADER,
        minOutAmount: swapQuote.minOutAmount,
        outToken: pool.tokenY.publicKey,
    });

    // return only the instructions
    return swapTx.instructions
}

async function main(){

    const getdlmmPool =  await createDlmm()

    // Get swap quote from Meteora
    const getQuote = await swapQuote(getdlmmPool)
    
    // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf") // can customize the client enpoint based on location

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip amount -> ${JITO_TIP}`)

    // Get Priority fee
    const priorityFee = await getPriorityFees() // OR set a custom number in lamports

    // Get Meteora-specific swap instructions
    const swapIx =  await swapIxGetter(getdlmmPool, getQuote, TRADER)

    // Create Tx
    const swapTx = new web3.Transaction()

    // Add instructions
    swapTx
    .add(
        web3.SystemProgram.transfer({
            fromPubkey: TRADER,
            toPubkey: jitoTipAccount,
            lamports: JITO_TIP, 
        })
    )
    .add(
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
    swapTx.feePayer = TRADER;

    // INSPECT TX - FOR DEBUGGING ONLY
    // console.log("Tx instructions:");
    // swapTx.instructions.forEach((ix, idx) => {
    // console.log(`Instruction #${idx}:`);
    // console.log("  ProgramID:", ix.programId.toBase58());
    // console.log("  Keys:", ix.keys.map(k => k.pubkey.toBase58()));
    // console.log("  Data:", ix.data.toString("hex"));
    // });

    // Compile + serialize the swap tx
    const compiledSwapTx = swapTx.compileMessage();
    const serializedV0Message = Buffer.from(
        compiledSwapTx.serialize()
    ).toString('base64');

    // Create JSON
    const jsonBody = {
        "vault_id": VAULT_ID, // Replace with your vault ID
        "signer_type": "api_signer",
        "sign_mode": "auto", // IMPORTANT
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": "manual", // IMPORTANT,
            "data": serializedV0Message,  // For legacy transactions, use `serializedLegacyMessage`
            "chain": "solana_mainnet"
        },
        "wait_for_state": "signed" // only for create-and-wait
    };

    // Write json body to file
    fs.writeFileSync(
        './txs/serialized_tx.json',
        JSON.stringify(jsonBody, null, 2), 
        'utf8'
    );
    console.log("Tx data written to .txs/serialized_tx.json");
}

main().catch(console.error);