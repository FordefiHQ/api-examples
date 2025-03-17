import fs from 'fs';
import * as axios from 'axios';
import { signWithApiSigner } from './signing/signer';
import { createAndSignTx } from './utils/process_tx'
import { pushToJito } from './jito/push_to_jito'
import { createJupiterSwapTx } from './jupiter/serialize_swap'
import dotenv from 'dotenv'


// Get Fordefi API token
dotenv.config()
const accessToken = process.env.FORDEFI_API_TOKEN;

async function main(): Promise<void> {
  if (!accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  // We create the tx (In this case the JUpiter swap but you can change it)
  const jsonBody = await createJupiterSwapTx()

  // Fetch serialized tx from json file
  const requestBody = JSON.stringify(jsonBody);

  // Define endpoint and create timestamp
  const pathEndpoint = '/api/v1/transactions/create-and-wait';
  const timestamp = new Date().getTime();
  const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;

  try {
      // Send tx payload to API Signer for signature
    const signature = await signWithApiSigner(payload);
    
    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx(pathEndpoint, accessToken, signature, timestamp, requestBody);
    const data = response.data;

    // FOR DEBUGGING
    // console.log(JSON.stringify(data, null, 2));
    // // Save signed tx to file
    // fs.writeFileSync('./txs/tx_to_broadcast.json', JSON.stringify(data, null, 2), 'utf-8');
    // console.log("Data has been saved to './txs/tx_to_broadcast.json'");

    try {

      const transaction_id = data.id
      console.log(`Transaction ID -> ${transaction_id}`)

      await pushToJito(transaction_id)

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