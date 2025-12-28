import * as kit from '@solana/kit';
import {
  SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN,
  isSolanaError,
  type TransactionPlanResult
} from '@solana/kit';
import { fordefiConfig } from './config';
import { signWithApiUserPrivateKey } from './signer';
import { createTxPlan } from './serialize-spl-transfer';
import { postTx, pollForSignedTransaction } from './process-tx';


/**
 * Sends a transaction message to Fordefi for signing and returns the signed raw transaction.
 */
async function signWithFordefi(
  message: kit.BaseTransactionMessage & kit.TransactionMessageWithFeePayer,
  rpc: ReturnType<typeof kit.createSolanaRpc>
): Promise<string> {
  // Get fresh blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const messageWithBlockhash = kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);

  // Partially sign (with NoopSigner - just serializes the message)
  const partiallySignedTx = await kit.partiallySignTransactionMessageWithSigners(messageWithBlockhash);
  const base64EncodedData = Buffer.from(partiallySignedTx.messageBytes).toString('base64');

  // Build Fordefi request
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

  // Sign and send to Fordefi
  const signature = await signWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);
  const response = await postTx(fordefiConfig, signature, timestamp, requestBody);
  const txId = response.data.id;
  console.log(`Submitted to Fordefi, ID: ${txId}`);

  // Poll for signed transaction
  const rawSignedTx = await pollForSignedTransaction(txId, fordefiConfig.accessToken);
  return rawSignedTx;
}

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }

  const rpc = kit.createSolanaRpc(fordefiConfig.mainnetRpc);

  // Create the transaction plan
  const transactionPlan = await createTxPlan(fordefiConfig);

  // Create executor that uses Fordefi for signing
  const transactionPlanExecutor = kit.createTransactionPlanExecutor({
    executeTransactionMessage: async (
      message: kit.BaseTransactionMessage & kit.TransactionMessageWithFeePayer,
    ) => {
      console.log('Signing transaction with Fordefi...');

      // Sign with Fordefi (includes getting blockhash)
      const rawSignedTxBase64 = await signWithFordefi(message, rpc);
      console.log('Transaction signed by Fordefi MPC ✅');

      // Broadcast via RPC directly (the transaction is already fully signed)
      // Fordefi returns base64, so we need to specify the encoding
      console.log('Broadcasting transaction...');
      const txSignature = await rpc.sendTransaction(
        rawSignedTxBase64 as kit.Base64EncodedWireTransaction,
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          encoding: 'base64'
        }
      ).send();

      console.log(`Transaction sent ✅ Signature: ${txSignature}`);

      // Decode the signed transaction to return a proper transaction object
      const txBytes = Buffer.from(rawSignedTxBase64, 'base64');
      const transaction = kit.getTransactionDecoder().decode(txBytes);

      return { transaction };
    },
  });

  // Execute the transaction plan with error handling
  console.log('Executing transaction plan...');
  try {
    await transactionPlanExecutor(transactionPlan);
    console.log('All transactions completed ✅');
  } catch (error) {
    if (isSolanaError(error, SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN)) {
      const result = error.context.transactionPlanResult as TransactionPlanResult;
      console.error('Transaction plan failed:', JSON.stringify(result, null, 2));
    }
    throw error;
  }
}

if (require.main === module) {
  main();
}
