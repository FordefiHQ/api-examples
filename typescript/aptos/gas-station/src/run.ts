import { buildPayload, sendToGasStation } from './serializer';
import { fordefiConfig, APTOS_NETWORK} from './config';
import { createAndSignTx, get_tx } from './process_tx';
import { signWithPrivateKey } from './signer';


async function main(): Promise<void> {
  // Sign transaction Fordefi vault
  const requestBody = JSON.stringify(await buildPayload(fordefiConfig, APTOS_NETWORK));
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
  const signedPayloadOne = await signWithPrivateKey(payload, fordefiConfig.privateKeyPem);

  console.log("Submitting transaction to Fordefi for signature 🔑")
  const response = await createAndSignTx(
    fordefiConfig.apiPathEndpoint, 
    fordefiConfig.accessToken, 
    signedPayloadOne, 
    timestamp, 
    requestBody
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  const signedFordefiTx = await get_tx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, response.data.id)

  if (signedFordefiTx){
    // Send signed transaction to gas station
    console.log("Transaction signed by Fordefi ✅");
    console.log(`Fordefi transaction ID: ${signedFordefiTx.id}`);
    const fullySignedTx = await get_tx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken,signedFordefiTx.id)
    console.log("Sending transaction to gas station ⛽");
    await sendToGasStation(fullySignedTx, fordefiConfig, APTOS_NETWORK)
  }
}

if (require.main === module) {
  main();
}