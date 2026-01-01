import * as crypto from 'crypto';
import * as kit from '@solana/kit';
import { fordefiConfig } from './config';
import { postTx, pollForSignedTransaction } from './process-tx';


export async function signPayloadWithApiUserPrivateKey(payload: string, privateKeyPem: string): Promise<string> {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');
  console.log("Payload signed by API User private key 🖋️✅");

  return signature
}

export async function signWithFordefi(
  message: kit.BaseTransactionMessage & kit.TransactionMessageWithFeePayer,
  rpc: ReturnType<typeof kit.createSolanaRpc>,
  customFeeLamports?: string
): Promise<string> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const messageWithBlockhash = kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);

  const partiallySignedTx = await kit.partiallySignTransactionMessageWithSigners(messageWithBlockhash);
  const base64EncodedData = Buffer.from(partiallySignedTx.messageBytes).toString('base64');

  // Build signatures array for Fordefi
  // First signature is always the fee payer (Fordefi vault) - must be null placeholder
  // Subsequent signatures are from local signers
  const signatures: Array<{ data: string | null }> = [];

  const feePayerAddress = message.feePayer.address;
  const allSignerAddresses = Object.keys(partiallySignedTx.signatures);

  for (const address of allSignerAddresses) {
    const sig = partiallySignedTx.signatures[address as kit.Address];
    if (address === feePayerAddress) {
      // Fee payer (Fordefi) - null placeholder
      signatures.unshift({ data: null });
    } else if (sig) {
      // Local signer with actual signature
      signatures.push({ data: Buffer.from(sig).toString('base64') });
    } else {
      // Signer without signature yet (shouldn't happen for local signers)
      signatures.push({ data: null });
    }
  }

  console.log(`Signatures array: ${signatures.length} entries (1 Fordefi + ${signatures.length - 1} local)`);

  const feeLamports = customFeeLamports || fordefiConfig.defaultFeeLamports;

  const jsonBody = {
    vault_id: fordefiConfig.deployerVaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "solana_transaction",
    details: {
      type: "solana_serialized_transaction_message",
      push_mode: "manual", // the planExecutor will push the tx for us to our custom RPC
      chain: "solana_devnet",
      data: base64EncodedData,
      signatures: signatures,
      skip_prediction: true, // speeds up signing but causes policy mismatch
      fee: {
        type: "custom",
        unit_price: feeLamports // we MUST set custom fees we calculate or Fordefi will overshoot the fee  
      }
    }
  };

  const requestBody = JSON.stringify(jsonBody);
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  const signature = await signPayloadWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);
  const response = await postTx(fordefiConfig, signature, timestamp, requestBody);
  const txId = response.data.id;
  console.log(`Submitted to Fordefi, ID: ${txId}`);

  const rawSignedTx = await pollForSignedTransaction(txId, fordefiConfig.accessToken);
  return rawSignedTx;
}

