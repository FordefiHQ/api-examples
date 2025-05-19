import axios from 'axios';
import { get_tx } from './process_tx'

const URL = 'https://mainnet.block-engine.jito.wtf/api/v1/transactions';

export async function pushToJito(transaction_id: string, accessToken:string): Promise<void> {
  try {
    const path = `/api/v1/transactions/${transaction_id}`;
    const fetchRawSignature = await get_tx(path, accessToken);
    const rawTransactionBase64 = (await fetchRawSignature.raw_transaction);
    console.log(`Raw signature -> ${rawTransactionBase64}`);

    const jitoPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [rawTransactionBase64, { encoding: 'base64' }],
    };

    const headers = { 'Content-Type': 'application/json' };
    const response = await axios.post(
      URL, 
      jitoPayload, 
      { headers }
    )
    console.log(`\n\nSuccessfully sent transaction to Jito!📡\nhttps://solana.fm/tx/${response.data.result}`);

  } catch (error: any) {
    console.error(`Error sending transaction: ${error}`);

    if (error.response) {
      console.error(`Response content:`, JSON.stringify(error.response.data, null, 2));
      console.error(`Status code:`, error.response.status);
    }
  }
}
