import * as kit from '@solana/kit';
import { createClient } from './solana-client-util';
import { createAndSignTx, pollForSignedTransaction } from './process_tx';
import { signWithApiUserPrivateKey } from '../src/signer';
import { FordefiSolanaConfig } from '../src/config';

// Serializes instructions into Fordefi's solana_serialized_transaction_message request body
export async function buildFordefiTxBody(
  vaultId: string,
  feePayer: kit.Address,
  ixes: kit.Instruction[]
) {
  const solana_client = createClient();
  const { value: latestBlockhash } = await solana_client.rpc.getLatestBlockhash().send();

  const txMessage = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    message => kit.setTransactionMessageFeePayer(feePayer, message),
    message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
    message => kit.appendTransactionMessageInstructions(ixes, message)
  );

  const signedTx = await kit.partiallySignTransactionMessageWithSigners(txMessage);
  const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');

  return {
    "vault_id": vaultId,
    "signer_type": "api_signer",
    "sign_mode": "auto",
    "type": "solana_transaction",
    "details": {
        "type": "solana_serialized_transaction_message",
        "push_mode": "auto",
        "chain": "solana_mainnet",
        "data": base64EncodedData
    }
  };
}

// Signs the request with the API User private key, submits to Fordefi and waits for the MPC signature
export async function signAndSubmit(fordefiConfig: FordefiSolanaConfig, jsonBody: any): Promise<string> {
  const requestBody = JSON.stringify(jsonBody);
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  const signature = await signWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);
  const response = await createAndSignTx(fordefiConfig, signature, timestamp, requestBody);
  const data = response.data;

  console.log("Transaction signed by vault and submitted to network 📡");
  console.log(`Transaction ID: ${data.id}`);
  await pollForSignedTransaction(data.id, fordefiConfig.accessToken);

  return data.id;
}
