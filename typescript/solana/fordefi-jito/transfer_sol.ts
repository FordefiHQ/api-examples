import fs from 'fs'
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import { getJitoTipAccount } from './utils/get_jito_tip_account'
import { getPriorityFees } from './utils/get_priority_fees'
import { getCuLimit } from './utils/get_cu_limit'
import dotenv from 'dotenv'


dotenv.config()
const QUICKNODE_KEY = process.env.QUICKNODE_MAINNET_KEY
const VAULT_ID = process.env.VAULT_ID
const FORDEFI_SOLANA_ADDRESS = process.env.FORDEFI_SOLANA_ADDRESS
const connection = new web3.Connection(`https://winter-solemn-sun.solana-mainnet.quiknode.pro/${QUICKNODE_KEY}/`)
const TRADER = new web3.PublicKey(`${FORDEFI_SOLANA_ADDRESS}`)
const RECEIVER = new web3.PublicKey('9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS')
const TRANSFER_AMOUNT = 1000 // amount in lamports (1 SOL = 1e9 lamports)


async function main(){

        // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf") // can customize

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip account -> ${jitoTipAccount}`)

    const jitoTip = 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)
    const priorityFee = await getPriorityFees() // OR set a custom number
    console.log(`Priority fee -> ${priorityFee}`)

    const transferTx = new web3.Transaction()

    // We want to get the blockhas first
    const { blockhash } = await connection.getLatestBlockhash();
    transferTx.recentBlockhash = blockhash;
    transferTx.feePayer = TRADER;

    // Then we add all the instructions
    transferTx
        .add(
            web3.SystemProgram.transfer({
                fromPubkey: TRADER,
                toPubkey: jitoTipAccount,
                lamports: jitoTip, 
            })
        )
        .add(
            web3.SystemProgram.transfer({
                fromPubkey: TRADER,
                toPubkey: RECEIVER,
                lamports: TRANSFER_AMOUNT
            })
        )
        .add(
            web3.ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: priorityFee, 
            })
        )

    // Now we get the CU limit after the transaction is properly set up
    const cuLimit = await getCuLimit(transferTx, connection) 
    // And finally we add the compute unit limit
    transferTx.add(
        web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: cuLimit ?? 100_000
        })
    )


    // FOR DEBUGGING ONLY

    // console.log("Tx instructions:");

    // transferTx.instructions.forEach((ix, idx) => {
    // console.log(`Instruction #${idx}:`);
    // console.log("  ProgramID:", ix.programId.toBase58());
    // console.log("  Keys:", ix.keys.map(k => k.pubkey.toBase58()));
    // console.log("  Data:", ix.data.toString("hex"));
    // });

    // Create JSON
    const jsonBody = {
        "vault_id": VAULT_ID,
        "note": "Hello Solana!",
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_transfer",
            "push_mode": "manual",
            "to": RECEIVER.toString(),
            "value": {
                "type": "value",
                "value": TRANSFER_AMOUNT.toString()
            },
            "asset_identifier": {
                "type": "solana",
                "details": {
                    "type": "native",
                    "chain": "solana_mainnet"
                }
            },
        },
        "wait_for_state": "signed"
    }

    // Write json body to file
    fs.writeFileSync(
        './txs/serialized_tx.json',
        JSON.stringify(jsonBody, null, 2), 
        'utf8'
    );
    console.log("Tx data written to .txs/serialized_tx.json");
}

main().catch(console.error);