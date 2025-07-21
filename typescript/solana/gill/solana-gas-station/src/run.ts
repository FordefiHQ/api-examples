import { signFeePayerVault, signWithSourceVault} from './serialize-spl';
import { createAndSignTx, get_tx } from './process_tx';
import { signWithPrivateKey } from './signer';
import { transactionFromBase64, getExplorerLink } from 'gill';
import { fordefiConfig } from './config';


async function main(): Promise<void> {
  // Partially sign transaction with fee-payer vault
  const requestBody = JSON.stringify(await signFeePayerVault(fordefiConfig));
  const timestamp = new Date().getTime();
  const feePayerVaultPayload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
  const signedPayloadOne = await signWithPrivateKey(feePayerVaultPayload, fordefiConfig.privateKeyPem);

  console.log("Submitting transaction to Fordefi for partial signature 🔑")
  const response = await createAndSignTx(
    fordefiConfig.apiPathEndpoint, 
    fordefiConfig.accessToken, 
    signedPayloadOne, 
    timestamp, 
    requestBody
  );
  await new Promise(resolve => setTimeout(resolve, 2000));

  const signedFordefiTx = await get_tx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, response.data.id)
  const fordefiPartialTx = await transactionFromBase64(signedFordefiTx.raw_transaction);

  const transactionData = {
      messageBytes: fordefiPartialTx.messageBytes,
      signatures: signedFordefiTx.signatures.map((signature: any) => signature.data ? Buffer.from(signature.data, 'base64') : null)
  }
  const serializedMessage = Buffer.from(
      transactionData.messageBytes
  ).toString('base64');
  const signatures = transactionData.signatures.map((x: any) => ({ data: x instanceof Buffer ? x.toString('base64') : null }))
  
  try {
    // Partially sign transaction with source vault and broadcast
    const sourceVaultRequest = await signWithSourceVault(fordefiConfig, signatures, serializedMessage);
    const sourceVaultRequestBody = JSON.stringify(sourceVaultRequest);
    const sourceVaultTimestamp = new Date().getTime();
    const sourceVaultPayload = `${fordefiConfig.apiPathEndpoint}|${sourceVaultTimestamp}|${sourceVaultRequestBody}`;
    const signedPayloadTwo = await signWithPrivateKey(sourceVaultPayload, fordefiConfig.privateKeyPem);
    
    console.log("Submitting transaction to Fordefi for 2cd signature 🔑🔑")
    const finalResponse = await createAndSignTx(
      fordefiConfig.apiPathEndpoint,
      fordefiConfig.accessToken, 
      signedPayloadTwo,
      sourceVaultTimestamp,
      sourceVaultRequestBody
    );
    if (finalResponse){
      console.log("Transaction fully signed and submitted to network ✅");
      console.log(`Final transaction ID: ${finalResponse.data.id}`);
      const fullySignedTx = await get_tx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken,finalResponse.data.id)
      console.log(await getExplorerLink({ transaction: fullySignedTx.hash }));
    }
  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}