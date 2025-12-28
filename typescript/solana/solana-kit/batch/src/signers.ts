import * as crypto from 'crypto';
import * as kit from '@solana/kit';
import { fordefiConfig } from './config';
import { postTx, pollForSignedTransaction } from './process-tx';


export async function signPayloadWithApiUserPrivateKey(payload: string, privateKeyPem: string): Promise<string> {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');
  console.log("Payload signed 🖋️✅ -> ", signature)

  return signature
}

export async function signWithFordefi(
  message: kit.BaseTransactionMessage & kit.TransactionMessageWithFeePayer,
  rpc: ReturnType<typeof kit.createSolanaRpc>
): Promise<string> {
  // get fresh blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const messageWithBlockhash = kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);

  // partially sign (we're using a NoopSigner so this just serializes the message)
  const partiallySignedTx = await kit.partiallySignTransactionMessageWithSigners(messageWithBlockhash);
  const base64EncodedData = Buffer.from(partiallySignedTx.messageBytes).toString('base64');

  const jsonBody = {
    vault_id: fordefiConfig.originVault,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "solana_transaction",
    details: {
      type: "solana_serialized_transaction_message",
      push_mode: "manual",
      chain: "solana_mainnet",
      data: base64EncodedData
    },
    wait_for_state: "signed"
  };

  const requestBody = JSON.stringify(jsonBody);
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  // sign with API User private key and send to Fordefi for MPC signing
  const signature = await signPayloadWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);
  const response = await postTx(fordefiConfig, signature, timestamp, requestBody);
  const txId = response.data.id;
  console.log(`Submitted to Fordefi, ID: ${txId}`);

  const rawSignedTx = await pollForSignedTransaction(txId, fordefiConfig.accessToken);
  return rawSignedTx;
}

