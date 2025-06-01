import { createAlt, extendAlt, doBatch, doSplBatch, deriveTokenRecipientList } from './helpers';
import { fordefiConfig, batchConfig, TOKEN_MINT } from './config';
import { Connection, PublicKey } from '@solana/web3.js';
import { createAndSignTx } from './process_tx';
import { signWithApiSigner } from './signer';

const connection = new Connection('https://api.mainnet-beta.solana.com');

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  // Prepare request body for tx payload
  let jsonBody;
  if (batchConfig.action === "create") {
    jsonBody = await createAlt(connection, batchConfig.fordefiVault, fordefiConfig);
  } else if (batchConfig.action === "extend") {
    let recipientsToExtend: PublicKey[];
    
    if (batchConfig.isSplBatch) {
      // For SPL tokens we first derive the ATA addresses
      recipientsToExtend = await deriveTokenRecipientList(batchConfig.recipientsList, TOKEN_MINT);
    } else {
      // For SOL transfers we use the wallet addresses directly
      recipientsToExtend = batchConfig.recipientsList;
    }
    
    jsonBody = await extendAlt(
      connection, 
      batchConfig.fordefiVault, 
      fordefiConfig, 
      batchConfig.tableAddress, 
      recipientsToExtend
    );
  } else if (batchConfig.action === "batch") {
    if (batchConfig.isSplBatch) {
      // For SPL batch, the doSplBatch func will derive ATAs internally
      jsonBody = await doSplBatch(
        connection, 
        batchConfig.fordefiVault, 
        fordefiConfig, 
        batchConfig.tableAddress, 
        batchConfig.recipientsList,
        batchConfig.amountPerRecipient, 
        TOKEN_MINT
      );
    } else {
      // For SOL batch
      jsonBody = await doBatch(
        connection, 
        batchConfig.fordefiVault, 
        fordefiConfig, 
        batchConfig.tableAddress, 
        batchConfig.recipientsList, 
        batchConfig.amountPerRecipient
      );
    }
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