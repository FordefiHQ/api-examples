import * as fs from 'fs';
import * as path from 'path';
import { fordefiConfig } from './config'; 
import { signWithApiSigner } from "../api_request/signer";
import { createStoreRequest } from "../api_request/formStoreRequestDirect";
import { createAndSignTx } from "../api_request/pushToApi";


async function main(): Promise<void> {

    const wasmBinary = fs.readFileSync(path.resolve(__dirname, '../artifacts/fordefi_archway.wasm'));
  
    try {
      // 1. Create json payload for transaction
      const requestBody = JSON.stringify(await createStoreRequest(fordefiConfig, wasmBinary));

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