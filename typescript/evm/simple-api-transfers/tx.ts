import dotenv from 'dotenv'
import { signWithApiSigner } from "./api_request/signer";
import { createRequest } from "./api_request/form_request";
import { createAndSignTx } from "./api_request/pushToApi";

////// TO CONFIGURE //////
dotenv.config()
const fordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  privateKeyPath: "./secret/private.pem",
  vaultId: process.env.VAULT_ID || "",
  senderAddress:process.env.VAULT_ADDRESS || "",
  pathEndpoint:  "/api/v1/transactions"
};

const txParams = {
  evmChain: "bsc",
  to: "0xF659feEE62120Ce669A5C45Eb6616319D552dD93",
  amount: "100000"
}

async function main(): Promise<void> {
    if (!fordefiConfig.accessToken) {
      console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
      return;
    }

    try {
      // 1. Prepare request body for Fordefi custody service
      const requestBody = JSON.stringify(await createRequest(fordefiConfig.vaultId, txParams.evmChain, txParams.to, txParams.amount ));

      // 2. Create signature for Fordefi API authentication
      const timestamp = new Date().getTime();
      const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`;
      const signature = await signWithApiSigner(fordefiConfig.privateKeyPath, payload);

      // 3. Submit the transaction to Fordefi API and wait for result
      const response = await createAndSignTx(fordefiConfig.pathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
      const fordDefiResult = response.data;
      console.log(fordDefiResult)
  
    } catch (error: any) {
      console.error(`Failed to sign the transaction: ${error.message}`);
    }
  }
  
  if (require.main === module) {
    main();
  }