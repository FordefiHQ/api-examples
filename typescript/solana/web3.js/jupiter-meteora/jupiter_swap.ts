import { signWithApiSigner } from './signer';
import { createAndSignTx } from './utils/process_tx'
import { pushToJito } from './push_to_jito'
import { createJupiterSwapTx } from './serializers/serialize_swap_jupiter'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const fordefiConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

const swapConfig = {
  swapAmount: '10000', // in lamports (1 SOL = 1e9 lamports)
  slippage: '50', // in bps
  inputToken: 'So11111111111111111111111111111111111111112', // SOL
  outputToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC Mint Address
  useJito: true, // if true we'll use Jito instead of Fordefi to broadcast the signed transaction
  jitoTip: 1000 // Jito tip amount in lamports (1 SOL = 1e9 lamports)
};

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  // We create the tx
  const jsonBody = await createJupiterSwapTx(fordefiConfig.vaultId, fordefiConfig.fordefiSolanaVaultAddress, swapConfig);

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

    if(swapConfig.useJito){
      try {
        const transaction_id = data.id
        console.log(`Transaction ID -> ${transaction_id}`)
  
        await pushToJito(transaction_id, fordefiConfig.accessToken)

      } catch (error: any){
        console.error(`Failed to push the transaction to Jito: ${error.message}`)
      }
    } else {
      console.log("Transaction submitted to Fordefi for broadcast ✅")
      console.log(`Transaction ID: ${data.id}`)
    }

  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}