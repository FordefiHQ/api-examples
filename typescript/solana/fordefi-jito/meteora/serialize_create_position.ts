import fs from 'fs'
import { BN } from 'bn.js'
import DLMM from '@meteora-ag/dlmm'
import * as meteora from '@meteora-ag/dlmm'
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { getJitoTipAccount } from '../utils/get_jito_tip_account'
import { getPriorityFees } from '../utils/get_priority_fees'
import { getCuLimit } from '../utils/get_cu_limit'
import dotenv from 'dotenv'


///////////// WIP ////////////
//////////////////////////////
//////////////////////////////
//////////////////////////////
//////////////////////////////
//////////////////////////////
/////// COME BACK LATER //////

dotenv.config()
const QUICKNODE_KEY = process.env.QUICKNODE_MAINNET_KEY
const VAULT_ID = process.env.VAULT_ID
const FORDEFI_SOLANA_ADDRESS = process.env.FORDEFI_SOLANA_ADDRESS
const connection = new web3.Connection(`${QUICKNODE_KEY}`)
const SOL_USDC_POOL = new web3.PublicKey('BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh') // info can be fetched from block explorer'
const TRADER = new web3.PublicKey(`${FORDEFI_SOLANA_ADDRESS}`)
const JITO_TIP = 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)

async function createDlmm(){

    const dlmmPool = DLMM.create(connection, SOL_USDC_POOL); // your pool
    return dlmmPool

}

async function getActiveBin(dlmmPool:any) {

    const activeBin = await dlmmPool.getActiveBin();

    return activeBin
}

async function createLiquidityPositionIx(dlmmPool: any, activeBin: any, positionPDA: web3.PublicKey, trader: web3.PublicKey){

    const TOTAL_RANGE_INTERVAL = 5; // 10 bins on each side of the active bin
    const minBinId = activeBin.bin_id - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.bin_id + TOTAL_RANGE_INTERVAL;

    // const newPositionKeypair = web3.Keypair.generate();

    // const newPositionTx = await dlmmPool.createEmptyPosition({
    //     positionPubKey: newPositionKeypair.publicKey,
    //     minBinId,
    //     maxBinId,
    //     user: trader
    // });
    // console.log(newPositionTx)

    const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
    Number(activeBin.price)
    );
    const totalXAmount = new BN(10000000);
    const totalYAmount = totalXAmount.mul(new BN(Number(activeBinPricePerToken)));

    // Create Position (Spot Balance deposit, Please refer ``example.ts` for more example)
    const createPositionTx =
        await dlmmPool.initializePositionAndAddLiquidityByStrategy({
            positionPubKey: trader,
            user: trader,
            totalXAmount,
            totalYAmount,
            strategy: {
            maxBinId,
            minBinId,
            strategyType: meteora.StrategyType.SpotBalanced,
            },
    });

    return createPositionTx.instructions

}

async function main(){


    const dlmmPool = await createDlmm()

    const activeBin =  await getActiveBin(dlmmPool)

    const activeBinPriceLamport = activeBin.price;

    const [positionPDA] = web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("position"), 
            TRADER.toBuffer(),     
        ],
        dlmmPool.program.programId 
    );

    const getCreatePositionTxIx = await createLiquidityPositionIx(dlmmPool, activeBin, positionPDA, TRADER)

    // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf") // can customize the client enpoint based on location

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip account -> ${jitoTipAccount}`)

   const priorityFee = await getPriorityFees() // OR set a custom number
   console.log(`Priority fee -> ${priorityFee}`)

   const createPositionTx = new web3.Transaction()

   createPositionTx
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
        ...getCreatePositionTxIx
    )   
    
    // OPTIONAL -> set CU limits the Meteora SDK is doing it for us`
    // const cuLimit = await getCuLimit(createPositionTx, connection) 
    // createPositionTx
    // .add(
    //     web3.ComputeBudgetProgram.setComputeUnitLimit({
    //         units: targetComputeUnitsAmount ?? 100_000 //
    //     })
    // )

    // Set blockhash + fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    createPositionTx.recentBlockhash = blockhash;
    createPositionTx.feePayer = TRADER;

    // Compile + serialize the merged transactions
    const comiledMessage = createPositionTx.compileMessage();
    const serializedV0Message = Buffer.from(
        comiledMessage.serialize()
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
        "wait_for_state": "signed"
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

// docs -> https://docs.meteora.ag/dynamic-pools-integration/using-typescript-client-sdk