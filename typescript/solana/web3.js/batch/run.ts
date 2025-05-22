import { signWithApiSigner } from './signer';
import { Connection, PublicKey } from '@solana/web3.js';
import { createAndSignTx } from './process_tx'
import { createAlt, extendAlt, doBatch } from './helpers'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const connection = new Connection('https://api.mainnet-beta.solana.com');

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

const fordefiVault =  new PublicKey(fordefiConfig.fordefiSolanaVaultAddress)
const alice = new PublicKey("9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS");
const bob = new PublicKey("FEwZdEBick94iFJcuVQS2gZyqhSDunSs82FTZgk26RpD");
const charlie = new PublicKey("GAPpdNzX3BnsHYJvRH2MiaTqKhDd7QFnwWskxtTLJsbf")
const recipients: PublicKey[] = [alice, bob, charlie];
const amountPerRecipient : bigint = 1_000n
const tableAddress = new PublicKey('2wFMVudMk2dCWcf16SMyxQ7TnQVLpvhH7nLNWyJyjrzL')  // // https://solscan.io/account/9sZtLMvmg6Jnxr6Sr1TcgJP9YcGY39yMug76FNfN4Azf
const action: string = "batch" // create, extend or batch

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }

  // Prepare request body for tx payload
  let jsonBody;
  if (action === "create") {
    jsonBody = await createAlt(connection, fordefiVault, fordefiConfig);
  } else if (action === "extend") {
    jsonBody = await extendAlt(connection, fordefiVault, fordefiConfig, tableAddress, recipients);
  } else if (action === "batch") {
    jsonBody = await doBatch(connection, fordefiVault, fordefiConfig, tableAddress, recipients, amountPerRecipient);
  } else {
    console.error('Error: Invalid action specified');
    return;
  }
  console.log("JSON request: ", jsonBody)

  // Fetch serialized tx from json file
  const requestBody = JSON.stringify(jsonBody);

  // Finalize tx payload for API Signer
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  try {
    // Send tx payload to API Signer for signature
    const signature = await signWithApiSigner(payload, fordefiConfig.privateKeyPem);
    
    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const data = response.data;
    console.log(data)
    console.log("Transaction submitted to Fordefi for broadcast ✅")
    console.log(`Transaction ID: ${data.id}`)

  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}