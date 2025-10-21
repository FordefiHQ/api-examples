import { signWithApiUserPrivateKey } from "./api_request/signer";
import { createRequest } from "./api_request/buildPayload";
import { createAndSignTx } from "./api_request/pushToApi";
import { fordefiConfig, txParams } from "./config"

async function main(): Promise<void> {
  // Check .env variables are set
  if (!fordefiConfig.accessToken || !fordefiConfig.vaultId || !fordefiConfig.senderAddress) {
    console.error('Error: Missing required configuration:');
    if (!fordefiConfig.accessToken) console.error('- FORDEFI_API_USER_TOKEN environment variable is not set');
    if (!fordefiConfig.vaultId) console.error('- VAULT_ID environment variable is not set');
    if (!fordefiConfig.senderAddress) console.error('- VAULT_ADDRESS environment variable is not set');
    return;
  };

  try {
    // 1. Create json payload for transaction
    const requestBody = JSON.stringify(await createRequest(fordefiConfig, txParams));

    // 2. Sign payload with API User private key
    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`;
    const signature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, payload);

    // 3. Submit the signed payload to Fordefi for tx creation and MPC signature
    const response = await createAndSignTx(fordefiConfig.pathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const fordDefiResult = response.data;
    console.log(fordDefiResult);
    

  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  };
};
  
if (require.main === module) {
    main();
}