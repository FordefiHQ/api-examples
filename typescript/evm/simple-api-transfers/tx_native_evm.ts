import dotenv from 'dotenv'
import fs from 'fs'

// Get Fordefi API token
dotenv.config()
const accessToken = process.env.FORDEFI_API_TOKEN;




async function main(): Promise<void> {
    if (!accessToken) {
      console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
      return;
    }
  
    try {
      const response = await ping(pathEndpoint, accessToken, payload);
      const data = response.data;
  
      // FOR DEBUGGING
      // console.log(JSON.stringify(data, null, 2));
      // // Save signed tx to file
      // fs.writeFileSync('./txs/tx_to_broadcast.json', JSON.stringify(data, null, 2), 'utf-8');
      // console.log("Data has been saved to './txs/tx_to_broadcast.json'");
  
      try {
  
        const transaction_id = data.id
        console.log(`Transaction ID -> ${transaction_id}`)
  
        await pushToJito(transaction_id)
  
      } catch (error: any){
        console.error(`Failed to push the transaction to Jito: ${error.message}`)
      }
  
  
    } catch (error: any) {
      console.error(`Failed to sign the transaction: ${error.message}`);
    }
  }
  
  if (require.main === module) {
    main();
  }