import { fordefiConfig, stakeWithMarinade } from "./config";
import { serializeStakeTx, serializeUnstakeTx } from './utils/marinade-serialize'
import { NativeStakingConfig, NativeStakingSDK } from '@marinade.finance/native-staking-sdk';
import { createAndSignTx } from "./utils/process_tx";
import { signWithApiSigner } from "./utils/signer";
import { Connection } from '@solana/web3.js'

const connection = new Connection("https://api.mainnet-beta.solana.com");

async function main(): Promise<void> {
    if (!fordefiConfig.accessToken) {
      console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
      return;
    }

    // Setup Marinade SDK
    const config = new NativeStakingConfig({ connection: connection});
    const sdk = new NativeStakingSDK(config);

    // We create the tx
    let jsonBody;
    let onPaid;
    if (stakeWithMarinade.direction == "unstake"){
      [jsonBody, onPaid] = await serializeUnstakeTx(fordefiConfig, connection, sdk)
    } else {
      jsonBody= await serializeStakeTx(fordefiConfig, connection, sdk)
    }
    console.log("JSON request: ", jsonBody)

    // Fetch serialized tx from json file
    const requestBody = JSON.stringify(jsonBody);
  
    // Define endpoint and create timestamp
    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
  
    try {
      // Send tx payload to API Signer for signature
      const signature = await signWithApiSigner(payload, fordefiConfig.privateKeyPem);
      
      // Send signed payload to Fordefi for MPC signature
      const response = await createAndSignTx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
      const data = response.data;
      console.log(data)
  
      if (data) {
        if (stakeWithMarinade.direction == "unstake" && typeof onPaid === 'function') {
          console.log("Transaction confirmed, notifying Marinade backend...")
          await onPaid(data.signatures[0])
          console.log("Marinade backend notified successfully")
        }
      } else {
        console.error("Failed to receive transaction data from Fordefi")
      }
    } catch (error: any) {
      console.error(`Failed to sign the transaction: ${error.message}`);
    }
  }
  if (require.main === module) {
    main();
  }