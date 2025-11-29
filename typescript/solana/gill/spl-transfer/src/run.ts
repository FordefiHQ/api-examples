import { createTx } from './serialize-spl-transfer';
import { signWithApiUserPrivateKey } from './signer';
import { createAndSignTx, get_tx } from './process_tx';
import { fordefiConfig, transferConfig } from './config';


async function main(): Promise<void> {
  console.log("Building the transaction payload 🏗️");
  const requestBody = JSON.stringify(await createTx(fordefiConfig, transferConfig));
  const timestamp = new Date().getTime();
  const feePayerVaultPayload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
  const signedPayloadOne = await signWithApiUserPrivateKey(feePayerVaultPayload, fordefiConfig.privateKeyPem);

  try {
  console.log("Submitting transaction to Fordefi for MPC signature 🔑")
  const response = await createAndSignTx(
    fordefiConfig.apiPathEndpoint, 
    fordefiConfig.accessToken, 
    signedPayloadOne, 
    timestamp, 
    requestBody
  );
  if (response.data){
      console.log("Transaction fully signed and submitted to network ✅");
      console.log(`Final transaction ID: ${response.data.id}`);
      const fullySignedTx = await get_tx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken,response.data.id)
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (fullySignedTx.explorer_url){
        console.log(fullySignedTx.explorer_url);
      } else {
        console.log("Transaction executed ✅");
      }
    }
  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}
if (require.main === module) {
  main();
}