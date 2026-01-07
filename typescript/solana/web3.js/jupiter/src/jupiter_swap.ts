import { signWithApiUserPrivateKey } from './utils/signer';
import { createAndSignTx, pollForSignedTransaction } from './utils/process_tx'
import { fordefiConfig, swapConfig } from './config';
import { createJupiterSwapTx, executeJupiterOrder } from './serialize_swap_jupiter'
import dotenv from 'dotenv'

dotenv.config()

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }

  // Step 1: Get order from Jupiter and create Fordefi request
  const { fordefiRequestBody, requestId } = await createJupiterSwapTx(fordefiConfig, swapConfig);
  console.log(`Jupiter requestId: ${requestId}`);

  const requestBodyStr = JSON.stringify(fordefiRequestBody);

  // Step 2: Sign the request with API User private key
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBodyStr}`;

  try {
    const signature = await signWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);

    // Step 3: Send to Fordefi for MPC signing
    const response = await createAndSignTx(
      fordefiConfig.apiPathEndpoint,
      fordefiConfig.accessToken,
      signature,
      timestamp,
      requestBodyStr
    );
    const data = response.data;
    console.log("Fordefi transaction created:", data.id);

    // Step 4: Poll for signed transaction from Fordefi
    console.log("Waiting for Fordefi to sign the transaction...");
    const signedTransaction = await pollForSignedTransaction(data.id, fordefiConfig.accessToken);
    console.log("Transaction signed by Fordefi ✅");

    // Step 5: Execute the signed transaction via Jupiter's /execute endpoint
    console.log("Submitting signed transaction to Jupiter...");
    const executeResponse = await executeJupiterOrder(signedTransaction, requestId, swapConfig.jupiterApiKey);

    if (executeResponse.status === "Success") {
      console.log('Swap successful! ✅');
      console.log(`Signature: ${executeResponse.signature}`);
      console.log(`https://solscan.io/tx/${executeResponse.signature}`);
    } else {
      console.error('Swap failed:', JSON.stringify(executeResponse, null, 2));
      if (executeResponse.signature) {
        console.log(`https://solscan.io/tx/${executeResponse.signature}`);
      }
    }

  } catch (error: any) {
    console.error(`Failed to complete swap: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
