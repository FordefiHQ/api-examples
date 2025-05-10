import { createAndSignTx } from '../utils/process_tx'
import { createTx } from './serialize-spl-transfer'
import { signWithApiSigner } from './signer';
import { pushToJito } from './push_to_jito';
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

export interface FordefiSolanaConfig {
  accessToken: string;
  originVault: string;
  originAddress: string;
  destAddress: string;
  feePayer: string;
  feePayerVault: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
  useJito: boolean;
  jitoTip: number
};

// Fordefi Config to configure
export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  originVault: process.env.ORIGIN_VAULT || "",
  originAddress: process.env.ORIGIN_ADDRESS || "",
  destAddress: process.env.DESTINATION_ADDRES || "",
  feePayer: process.env.FEE_PAYER_ADDRESS || "",
  feePayerVault: process.env.FEE_PAYER_VAULT || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait',
  useJito: true,
  jitoTip: 1000,
};


async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  // We create the tx
  const jsonBody = await createTx(fordefiConfig)
  console.log("JSON request: ", jsonBody)

  // Fetch serialized tx from json file
  const  requestBody = JSON.stringify(jsonBody);

  // Define endpoint and create timestamp
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  try {
    // Send tx payload to API Signer for signature
    const signature = await signWithApiSigner(payload, fordefiConfig.privateKeyPem);
    
    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const data = response.data;
    console.log(data)

    if(fordefiConfig.useJito){
      try {
        const transaction_id = data.id
        console.log(`Transaction ID -> ${transaction_id}`)
  
        await pushToJito(transaction_id, fordefiConfig.accessToken)
  
      } catch (error: any){
        console.error(`Failed to push the transaction to Orca: ${error.message}`)
      }
    } else {
    console.log("Transaction signed by source vault and submitted to network ✅");
    console.log(`Final transaction ID: ${data.id}`);
    }

  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}