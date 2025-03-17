import axios from 'axios';
import * as web3 from '@solana/web3.js'
import * as jito from 'jito-ts'
import dotenv from 'dotenv'
import { PublicKey } from '@solana/web3.js';
import { getJitoTipAccount } from '../utils/get_jito_tip_account'

////// TO CONFIGURE //////
dotenv.config()
const connection = new web3.Connection("https://api.mainnet-beta.solana.com")
const JITO_TIP = 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)
const SWAP_AMOUNT = '1000000' // in lamports
const SLIPPAGE =  '50' //in bps
const INPUT_TOKEN = 'So11111111111111111111111111111111111111112' // SOL
const OUTPUT_TOKEN = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC Mint Address
////// TO CONFIGURE //////


// Get quote from Jupiter
async function getSwapQuote(swap_amount: string, slippage: string, input_token: string, output_token: string): Promise<any> {

    const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
        params: {
            inputMint:input_token,
            outputMint: output_token,
            amount: swap_amount,
            slippageBps: slippage,
            maxAccounts: 32, // Limit accounts involved
            restrictIntermediateTokens: false, 
        }
    });
    
    return quoteResponse.data;
}

async function getSwapTxIx(quote: any, user: PublicKey) {

    // We get a series of instructions and a lookup table from the API
    const response = await axios.post('https://quote-api.jup.ag/v6/swap-instructions', {
        quoteResponse: quote,
        userPublicKey: user.toBase58(),
        minimizeSteps: true
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    const { computeBudgetInstructions, setupInstructions, swapInstruction, cleanupInstruction } = response.data;
    const lookUpTable = response.data.addressLookupTableAddresses[0]

    // We map the instructions
    const instructions = [
        ...(computeBudgetInstructions ?? []),
        ...(setupInstructions ?? []),
        swapInstruction,
        ...(cleanupInstruction ? [cleanupInstruction] : [])
    ].map((ix) => {
        return {
            programId: new PublicKey(ix.programId),
            keys: ix.accounts.map((key: any) => ({
                pubkey: new PublicKey(key.pubkey),
                isSigner: key.isSigner,
                isWritable: key.isWritable
            })),
            data: Buffer.from(ix.data, 'base64')
        };
    });

    // We return the instructions and the lookuptable
    return [
        instructions, 
        lookUpTable  
    ];
}

export async function createJupiterSwapTx(vaultId: string, fordefiSolanaVaultAddress: string){

    // We generate a quote from Jupiter
    const quote = await getSwapQuote(SWAP_AMOUNT, SLIPPAGE, INPUT_TOKEN, OUTPUT_TOKEN)

    // We grab the instructions and the lookup table
    const [jupiterSwapTxIx, lookupTableAddress] = await getSwapTxIx(quote, new web3.PublicKey(fordefiSolanaVaultAddress))

    // We fetch the actual lookup table
    const lookupTableAccount = await connection.getAddressLookupTable(
        new web3.PublicKey(lookupTableAddress)
    ).then(result => result.value);
    if (!lookupTableAccount) {
        throw new Error("Lookup table not found");
    }

    // Create Jito client instance
    const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf") // can customize the client enpoint based on location

    // Get Jito Tip Account
    const jitoTipAccount = await getJitoTipAccount(client)
    console.log(`Tip amount -> ${JITO_TIP}`)

    // Create all instructions including Jito tip
    const swapTxIx = [
        web3.SystemProgram.transfer({
            fromPubkey: new web3.PublicKey(fordefiSolanaVaultAddress),
            toPubkey: jitoTipAccount,
            lamports: JITO_TIP,
        }),
        ...jupiterSwapTxIx
    ];

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // We create a V0 TransactionMessage and add our lookup table
    const messageV0 = new web3.VersionedTransaction(
        new web3.TransactionMessage({
            payerKey: new web3.PublicKey(fordefiSolanaVaultAddress),
            recentBlockhash: blockhash,
            instructions: swapTxIx
        }).compileToV0Message([lookupTableAccount])
    );

    // We serialize the transaction message
    const serializedMessage = Buffer.from(
        messageV0.message.serialize()
    ).toString('base64');

    // We create a JSON
    const jsonBody = {
        "vault_id": vaultId, // Replace with your vault ID
        "signer_type": "api_signer",
        "sign_mode": "auto", // IMPORTANT
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": "manual", // IMPORTANT,
            "data": serializedMessage,  // For legacy transactions, use `serializedLegacyMessage`
            "chain": "solana_mainnet"
        },
        "wait_for_state": "signed" // only for create-and-wait
    };

    // // For debugging - write json body to file
    // fs.writeFileSync(
    //     './txs/serialized_tx.json',
    //     JSON.stringify(jsonBody, null, 2), 
    //     'utf8'
    // );
    // console.log("Tx data written to .txs/serialized_tx.json");

    return jsonBody


}