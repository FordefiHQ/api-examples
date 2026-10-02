import { Base64EncodedWireTransaction } from '@solana/kit';

const URL = 'https://mainnet.block-engine.jito.wtf/api/v1/transactions';

export async function pushToJito(rawTransactionBase64: Base64EncodedWireTransaction): Promise<void> {
  console.log(`Raw transaction: ${rawTransactionBase64}`);

  const jitoPayload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sendTransaction',
    params: [rawTransactionBase64, { encoding: 'base64' }],
  };

  const response = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jitoPayload),
  });
  const data: any = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Jito rejected the transaction (status ${response.status}): ${JSON.stringify(data.error ?? data)}`);
  }
  console.log(`Successfully sent transaction to Jito!📡\nhttps://solana.fm/tx/${data.result}`);
}
