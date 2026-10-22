import { signWithApiUserPrivateKey } from "./api_request/signer";
import { createRequest } from "./api_request/buildPayload";
import { createAndSignTx } from "./api_request/pushToApi";
import { fordefiConfig, deployParams } from "./config"

async function main(): Promise<void> {
  // Check .env variables are set
  if (!fordefiConfig.accessToken || !fordefiConfig.vaultId || !fordefiConfig.senderAddress || !deployParams.custom_nonce) {
    console.error('Error: Missing required configuration:');
    if (!fordefiConfig.accessToken) console.error('- FORDEFI_API_USER_TOKEN environment variable is not set');
    if (!fordefiConfig.vaultId) console.error('- VAULT_ID environment variable is not set');
    if (!fordefiConfig.senderAddress) console.error('- VAULT_ADDRESS environment variable is not set');
    if (!deployParams.custom_nonce) console.error('- CUSTOM_NONCE environment variable is not set');
    return;
  };
  if (!/^\d+$/.test(deployParams.custom_nonce)) {
    console.error(`Error: CUSTOM_NONCE must be a non-negative integer, got "${deployParams.custom_nonce}"`);
    return;
  };

  try {
    // 1. Create json payload for the deployment transaction (bytecode from Foundry artifact)
    const requestBody = JSON.stringify(await createRequest(fordefiConfig, deployParams));

    // 2. Sign payload with API User private key
    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`;
    const signature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, payload);

    // 3. Submit the signed payload to Fordefi for tx creation and MPC signature
    const response = await createAndSignTx(fordefiConfig.pathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const fordDefiResult = response.data;
    console.log(fordDefiResult);

  } catch (error: any) {
    console.error(`Failed to deploy the contract: ${error.message}`);
  };
};

if (require.main === module) {
    main();
}
