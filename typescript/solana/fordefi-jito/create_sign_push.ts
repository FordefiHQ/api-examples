import fs from 'fs';
import * as axios from 'axios';
import { signWithApiSigner } from './signing/signer';
import { createAndSignTx } from './utils/process_tx'
import { pushToJito } from './jito/push_to_jito'
import dotenv from 'dotenv'


// Get Fordefi API token
dotenv.config()
const accessToken = process.env.FORDEFI_API_TOKEN;

// Fetch serialized tx from json file
const requestJson = JSON.parse(fs.readFileSync('./txs/serialized_tx.json', 'utf-8'));
const requestBody = JSON.stringify(requestJson);

// Define endpoint and create timestamp
// const pathEndpoint = '/api/v1/transactions';
const pathEndpoint = '/api/v1/transactions/create-and-wait';
const timestamp = new Date().getTime();
const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;

// Call 
async function ping(
  path: string,
  accessToken: string,
  payload: string
): Promise<axios.AxiosResponse> {

  // Send tx payload to API Signer for signature
  const signature = await signWithApiSigner(payload);

  try {

    // Send signed payload to Fordefi for MPC signature
    const respTx = await createAndSignTx(path, accessToken, signature, timestamp, requestBody);

    // Throws for non-2xx status codes
    if (respTx.status < 200 || respTx.status >= 300) {
      throw new Error(`HTTP error status code: ${respTx.status}`);
    }

    return respTx;

  } catch (error: any) {
    // If the error is an Axios error, we can parse its details
    if (error.response) {
      const statusCode = error.response.status;
      let errorMessage = `HTTP error occurred: status = ${statusCode}`;
      try {
        // If response data is JSON, attach it
        const errorDetail = error.response.data;
        errorMessage += `\nError details: ${JSON.stringify(errorDetail)}`;
      } catch (jsonErr) {
        // If the response is not JSON, attach raw text
        errorMessage += `\nRaw response: ${error.response.data}`;
      }
      throw new Error(errorMessage);
    }
    // Network or other unknown error
    throw new Error(`Network error occurred: ${String(error)}`);
  }
}

async function main(): Promise<void> {
  if (!accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }

  try {
    const response = await ping(pathEndpoint, accessToken, payload);
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