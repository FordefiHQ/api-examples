import { signWithApiSigner } from './signer';
import { createAndSignTx } from './utils/process_tx'
import { pushToJito } from './push_to_jito'
import { createMeteoraSwapTx } from './meteora/serialize_swap'
import { PublicKey } from '@solana/web3.js'
import { BN } from 'bn.js'
import dotenv from 'dotenv'
import fs from 'fs'


// Fordefi Config to configure
dotenv.config()
const fordefiConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

const swapConfig = {
  jitoTip: 1000, // Jito tip amount in lamports (1 SOL = 1e9 lamports)
  swapAmount: new BN(100), // in lamports
  pool: new PublicKey('A8nPhpCJqtqHdqUk35Uj9Hy2YsGXFkCZGuNwvkD3k7VC') // TRUMP_USDC_POOL
}


async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  // We create the tx (In this case we're using Jupiter)
  const jsonBody = await createMeteoraSwapTx(fordefiConfig.vaultId, fordefiConfig.fordefiSolanaVaultAddress, swapConfig)

  // Fetch serialized tx from json file
  const requestBody = JSON.stringify(jsonBody);

  // Define endpoint and create timestamp
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  try {
    // Send tx payload to API Signer for signature
    const signature = await signWithApiSigner(payload, fordefiConfig.privateKeyPem);
    
    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const data = response.data;

    // FOR DEBUGGING
    // console.log(JSON.stringify(data, null, 2));
    // // Save signed tx to file
    // fs.writeFileSync('./txs/tx_to_broadcast.json', JSON.stringify(data, null, 2), 'utf-8');
    // console.log("Data has been saved to './txs/tx_to_broadcast.json'");

    try {

      const transaction_id = data.id
      console.log(`Transaction ID -> ${transaction_id}`)

      await pushToJito(transaction_id, fordefiConfig.accessToken, fordefiConfig.privateKeyPem)

    } catch (error: any){
      console.error(`Failed to push the transaction to Jito: ${error.message}`)
    }


  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}