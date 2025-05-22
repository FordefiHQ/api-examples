import { signWithApiSigner } from './signer';
import { Connection, PublicKey } from '@solana/web3.js';
import { createAndSignTx } from './utils/process_tx'
import { pushToJito } from './utils/push_to_jito'
import { createAlt } from './helpers'
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

// Fordefi Config to configure
export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

const connection = new Connection('https://api.mainnet-beta.solana.com');
const fordefiVault =  new PublicKey(fordefiConfig.fordefiSolanaVaultAddress)
const alice = new PublicKey("9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS");
const bob = new PublicKey("FEwZdEBick94iFJcuVQS2gZyqhSDunSs82FTZgk26RpD");
const recipients: PublicKey[] = [alice, bob];
const lamportsPerRecipient : bigint = 1_000n
const useJito = false

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  // We create the tx
  const jsonBody = await createAlt(connection, fordefiVault, fordefiConfig, recipients, lamportsPerRecipient)
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

    if(useJito){
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