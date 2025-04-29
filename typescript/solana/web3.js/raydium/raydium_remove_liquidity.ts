import { signWithApiSigner } from './signer';
import { Connection } from '@solana/web3.js'
import { TxVersion } from '@raydium-io/raydium-sdk-v2'
import { removeLiquidityFromRaydiumPool } from './serializers/serialize_raydium_remove_liquidity'
import { createAndSignTx } from './utils/process_tx'
import { pushToJito } from './push_to_jito'
import dotenv from 'dotenv'
import BN from 'bn.js'
import fs from 'fs'

dotenv.config()

export interface FordefiSolanaConfig {
  accessToken: string;
  vaultId: string;
  fordefiSolanaVaultAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
};

export interface RaydiumRemoveLiquidityConfig {
  raydiumPool: string;
  closePosition: boolean;
  amountMinA: BN,
  amountMinB: BN,
  txVersion: TxVersion;
  cuLimit: number;
  useJito: boolean;
  jitoTip: number
};

// Fordefi Config to configure
export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

export const removeLiquidityConfig: RaydiumRemoveLiquidityConfig = {
  raydiumPool: "8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj", // SOL/USDC pool
  closePosition: true, // set to false for partial liquidity decrease
  amountMinA: new BN(0), // set if closePosition=true
  amountMinB: new BN(0), // set if closePosition=true
  txVersion: TxVersion.V0,
  cuLimit: 700_000,
  useJito: false, // if true we'll use Jito instead of Fordefi to broadcast the signed transaction
  jitoTip: 1000, // Jito tip amount in lamports (1 SOL = 1e9 lamports)
};

export const connection = new Connection('https://api.mainnet-beta.solana.com')

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  // We create the tx
  const jsonBody = await removeLiquidityFromRaydiumPool(fordefiConfig, removeLiquidityConfig, connection)
  console.log("JSON request: ", jsonBody)

  // Fetch serialized tx from json file
  const requestBody = JSON.stringify(jsonBody);

  // Create payload
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  try {
    // Send tx payload to API Signer for signature
    const signature = await signWithApiSigner(payload, fordefiConfig.privateKeyPem);
    
    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const data = response.data;
    console.log(data)

    if(removeLiquidityConfig.useJito){
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