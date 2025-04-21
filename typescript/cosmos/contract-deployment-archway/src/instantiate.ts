import { fordefiConfig } from './config';
import { signWithApiSigner } from "../api_request/signer";
import { createInstantiateRequest } from "../api_request/formInstantiateRequestDirect";
import { createAndSignTx } from "../api_request/pushToApi";


// Contract specific variables
const codeId = 853; // Replace with the actual code ID from the Archway explorer on Mintscan
const contractLabel = "Fordefi Deployed Contract!";
const instantiateMsg = {
  count: 42
};
const msgString = JSON.stringify(instantiateMsg);

async function main(): Promise<void> {
  try {
    // 1. Create json payload for instantiate transaction
    const requestBody = JSON.stringify(
      await createInstantiateRequest(
        fordefiConfig,
        codeId,
        contractLabel,
        msgString,
      )
    );

    // 2. Sign with Fordefi API Signer
    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`;
    const signature = await signWithApiSigner(fordefiConfig.privateKeyPath, payload);

    // 3. Submit the transaction to Fordefi API and wait for result
    const response = await createAndSignTx(fordefiConfig.pathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const fordDefiResult = response.data;
    console.log(fordDefiResult);
    
  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}
  
if (require.main === module) {
  main();
}