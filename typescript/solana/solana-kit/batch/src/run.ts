import { fordefiConfig } from './config';
import { signWithApiUserPrivateKey } from './signer';
import { createTx } from './serialize-spl-transfer';
import { postTx } from './process-tx';


async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  // We create the txs from the transaction plan
  const jsonBodies = await createTx(fordefiConfig);

  console.log(`Processing ${jsonBodies.length} transaction(s)...`);

  for (let i = 0; i < jsonBodies.length; i++) {
    const jsonBody = jsonBodies[i];
    const requestBody = JSON.stringify(jsonBody);
    // Define endpoint and create timestamp
    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

    try {
      // Sign payload with API User private key
      const signature = await signWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);

      // Send signed payload to Fordefi for MPC signature
      const response = await postTx(fordefiConfig, signature, timestamp, requestBody);
      console.log(`Transaction ${i + 1}/${jsonBodies.length} signed by source vault and submitted to network ✅`);
      console.log(`Transaction ID: ${response.data.id}`);
    } catch (error: any) {
      console.error(`Failed to sign transaction ${i + 1}: ${error.message}`);
    }
  }
}

if (require.main === module) {
  main();
}