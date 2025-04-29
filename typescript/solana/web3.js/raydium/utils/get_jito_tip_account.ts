import { PublicKey } from '@solana/web3.js'
import * as jito from 'jito-ts'

const client = jito.searcher.searcherClient("frankfurt.mainnet.block-engine.jito.wtf")

export async function getJitoTipAccount(){
    const tipAccountsResult = await client.getTipAccounts();
    if (!tipAccountsResult.ok) {
        throw new Error(`Failed to get tip accounts: ${tipAccountsResult.error}`);
    }
   // Randomly select a Jito tip account index between 0 and 2
   const randomIndex = Math.floor(Math.random() * 3);
   const jitoTipAccount = new PublicKey(tipAccountsResult.value[randomIndex]);
   console.log(`Tip account (index ${randomIndex}) -> ${jitoTipAccount}`);
   
   return jitoTipAccount;
}