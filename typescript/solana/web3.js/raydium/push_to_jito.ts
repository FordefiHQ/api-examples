import axios from 'axios';
import { get_tx } from './utils/process_tx'

export async function pushToJito(transaction_id: string, accessToken:string): Promise<void> {
  try {
    // Prep path
    const path = `/api/v1/transactions/${transaction_id}`;
    // Fetch raw signature from tx object
    const fetchRawSignature = await get_tx(path, accessToken);
    const rawTransactionBase64 = (await fetchRawSignature.raw_transaction);
    console.log(`Raw signature -> ${rawTransactionBase64}`);

    // Prepare Jito request
    const url = 'https://mainnet.block-engine.jito.wtf/api/v1/transactions';
    const jitoPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [rawTransactionBase64, { encoding: 'base64' }],
    };
    // Push tx to Jito's Block Engine
    const headers = { 'Content-Type': 'application/json' };
    const response = await axios.post(
      url, 
      jitoPayload, 
      { headers }
    )
    console.log(
      `\n\nSuccessfully sent transaction to Jito!📡\nhttps://solana.fm/tx/${response.data.result}`
    );

  } catch (error: any) {
    console.error(`Error sending transaction: ${error}`);

    // Handle errors if any
    if (error.response) {
      console.error(`Response content: ${error.response.data}`);
    }
  }
}
