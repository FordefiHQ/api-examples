import { signWithApiUserPrivateKey } from "./api_request/signer";
import { fordefiConfig, contractCallParams } from "./config";
import { createRequest } from "./api_request/buildPayload";
import { createAndSignTx } from "./api_request/pushToApi";

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken || !fordefiConfig.vaultId || !fordefiConfig.vaultAddress) {
    console.error('Error: Missing required configuration:');
    if (!fordefiConfig.accessToken) console.error('- FORDEFI_API_USER_TOKEN environment variable is not set');
    if (!fordefiConfig.vaultId) console.error('- STACKS_VAULT_ID environment variable is not set');
    if (!fordefiConfig.vaultAddress) console.error('- STACKS_VAULT_ADDRESS environment variable is not set');
    return;
  };

  try {
    // 1. Create json payload for transaction
    const requestBody = JSON.stringify(await createRequest(fordefiConfig, contractCallParams));

    // 2. Sign payload with API User private key
    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`;
    const signature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, payload);

    // 3. Submit the signed payload to Fordefi for tx creation and MPC signature
    const response = await createAndSignTx(
      fordefiConfig.pathEndpoint, 
      fordefiConfig.accessToken, 
      signature, 
      timestamp, 
      requestBody, 
      fordefiConfig.baseApiUrl
    );
    if (response){
      console.log("Tx successfully pushed to Fordefi!")
    }

  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  };
};

if (require.main === module) {
  main();
}
