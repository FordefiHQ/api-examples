import { fordefiConfig, transferConfig } from './config';
import { createAndSignTx } from '../utils/process_tx';
import { signWithApiUserPrivateKey } from './signer';
import { createTx } from './serialize-spl-transfer';
import { pushToJito } from '../utils/push_to_jito';


async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  // We create the tx
  const jsonBody = await createTx(fordefiConfig, transferConfig);
  // Fetch serialized tx from json file
  const requestBody = JSON.stringify(jsonBody);
  // Define endpoint and create timestamp
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  try {
    // Sign payload with API User private key
    const signature = await signWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);
    
    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const data = response.data;
    console.log(data);

    // Optional push to Jito
    if(transferConfig.useJito){
      try {
        const transaction_id = data.id;
        console.log(`Transaction ID -> ${transaction_id}`);
  
        await pushToJito(transaction_id, fordefiConfig.accessToken);
  
      } catch (error: any){
        console.error(`Failed to push the transaction to Orca: ${error.message}`);
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