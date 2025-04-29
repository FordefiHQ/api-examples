import { signWithApiSigner } from './signer';
import { TxVersion } from '@raydium-io/raydium-sdk-v2'
import { swapWithRaydium } from './serializers/serialize_raydium_swap'
import { createAndSignTx } from './utils/process_tx'
import { pushToJito } from './push_to_jito'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

export interface FordefiSolanaConfig {
  accessToken: string;
  vaultId: string;
  fordefiSolanaVaultAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
};

export interface RaydiumSwapConfig {
  raydiumPool: string;
  inputMint: string;
  isInputSol: boolean;
  isOutputSol: boolean;
  outputMint: string;
  swapAmount: bigint;
  slippage: number;
  txVersion: string;
  useJito: boolean;
  jitoTip: number;
};

// Fordefi Config to configure
export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

export const swapConfig: RaydiumSwapConfig = {
  raydiumPool: "FdjBRWXzieV1Qtn8FLDWWk2HK1HSQWYduo8y4F1e8GWu", // SOL/Fartcoin pool
  inputMint: "So11111111111111111111111111111111111111112", // the input token in the swap, SOL in this case
  isInputSol: true,
  outputMint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
  isOutputSol: false,
  swapAmount: 10_000n, // in lamports
  slippage: 1, // in % (1 = 100 pbs)
  txVersion: 'V0',
  useJito: false, // if true we'll use Jito instead of Fordefi to broadcast the signed transaction
  jitoTip: 1000, // Jito tip amount in lamports (1 SOL = 1e9 lamports)
};


async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  // We create the tx
  const jsonBody = await swapWithRaydium(fordefiConfig, swapConfig)
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

    if(swapConfig.useJito){
      try {
        const transaction_id = data.id
        console.log(`Transaction ID -> ${transaction_id}`)
  
        await pushToJito(transaction_id, fordefiConfig.accessToken)
  
      } catch (error: any){
        console.error(`Failed to push the transaction to Raydium: ${error.message}`)
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