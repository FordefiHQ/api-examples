import * as kit from '@solana/kit';
import { fordefiConfig } from './config';
import { createTxPlan } from './tx-planner';
import { signWithFordefi } from './signers';
import { createClient, Client } from "./solana-client-util";

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  const solana_client: Client = await createClient();
  const transactionPlan = await createTxPlan(fordefiConfig);

  // Create executor that uses Fordefi for signing
  const transactionPlanExecutor = kit.createTransactionPlanExecutor({
    executeTransactionMessage: async (
      message: kit.BaseTransactionMessage & kit.TransactionMessageWithFeePayer,
    ) => {
      console.log('Signing transaction with Fordefi...');

      // Sign with Fordefi (includes getting blockhash)
      const rawSignedTxBase64 = await signWithFordefi(message, solana_client.rpc);
      console.log('Transaction signed by Fordefi MPC 🖋️✅');

      // Broadcast via RPC directly (the transaction is already fully signed)
      // Fordefi returns base64, so we need to specify the encoding
      console.log('Broadcasting transaction...');
      const txSignature = await solana_client.rpc.sendTransaction(
        rawSignedTxBase64 as kit.Base64EncodedWireTransaction,
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          encoding: 'base64'
        }
      ).send();

      console.log(`Transaction broadcast📡\nSignature: ${txSignature}`);

      const txBytes = Buffer.from(rawSignedTxBase64, 'base64');
      const transaction = kit.getTransactionDecoder().decode(txBytes);

      return { transaction };
    },
  });
  console.log('Executing transaction plan...');
  try {
    await transactionPlanExecutor(transactionPlan);
    console.log('Transaction plan executed ✅');
  } catch (error) {
    if (kit.isSolanaError(error, kit.SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN)) {
      const result = error.context.transactionPlanResult as kit.TransactionPlanResult;
      console.error('Transaction plan failed:', JSON.stringify(result, null, 2));
    }
    throw error;
  }
}

if (require.main === module) {
  main();
}
