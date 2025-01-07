import dotenv from 'dotenv'
import axios from 'axios';
import { signWithApiSigner } from '../signing/signer'
import { get_tx } from '../utils/process_tx'

dotenv.config()

export async function pushToJito(transaction_id: string): Promise<void> {
  try {

    // 1. Prep variables
    const accessToken = process.env.FORDEFI_API_TOKEN || '';
    const path = `/api/v1/transactions/${transaction_id}`;
    const requestBody = '';
    const timestamp = new Date().getTime();; 

    // 2. Sign payload
    const payload = `${path}|${timestamp}|${requestBody}`;
    const signature = await signWithApiSigner(payload);

    // 3. Fetch raw signature from tx object
    const fetchRawSignature = await get_tx(path, accessToken, signature, timestamp, requestBody);
    const rawTransactionBase64 = (await fetchRawSignature.raw_transaction);
    console.log(`Raw signature -> ${rawTransactionBase64}`);

    // 4. Prepare Jito request
    const url = 'https://mainnet.block-engine.jito.wtf/api/v1/transactions';
    const jitoPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [rawTransactionBase64, { encoding: 'base64' }],
    };

    // 5. Push tx to Jito
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

    // Handle Axios errors if any
    if (error.response) {
      console.error(`Response content: ${error.response.data}`);
    }
  }
}
