import { fordefiConfig, stakeWithMarinade } from "./config";
import { serializeMarinadeTx } from './utils/marinade-serialize'
import { createAndSignTx } from "./utils/process_tx";
import { signWithApiSigner } from "./utils/signer";

async function main(): Promise<void> {
    if (!fordefiConfig.accessToken) {
      console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
      return;
    }
    // We create the tx
    const jsonBody = await serializeMarinadeTx(fordefiConfig)
    console.log("JSON request: ", jsonBody)

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
      console.log(data)
  
      if (data) {
        console.log("Transaction submitted to Fordefi for broadcast ✅")
        console.log(`Transaction ID: ${data.id}`)
      } else {
        console.error("Failed to receive transaction data from Fordefi")
      }
    } catch (error: any) {
      console.error(`Failed to sign the transaction: ${error.message}`);
    }
  }
  if (require.main === module) {
    main();
  }