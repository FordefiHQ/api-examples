import * as kit from '@solana/kit';
import { fordefiConfig } from './config';
import { createTxPlan } from './tx-planner';
import { signWithFordefi } from './signers';
import { createClient, Client } from "./utils/solana-client-util";

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  const solana_client: Client = await createClient();
  const transactionPlan = await createTxPlan(fordefiConfig, solana_client);

  // current tx counter for tracking progress
  let currentTx = 0;

  // create executor that uses Fordefi for signing with retry logic
  const transactionPlanExecutor = kit.createTransactionPlanExecutor({
    executeTransactionMessage: async (
      message: kit.BaseTransactionMessage & kit.TransactionMessageWithFeePayer,
    ) => {
      currentTx++;
      const maxRetries = 3;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`\n[TX ${currentTx}] Signing with Fordefi (attempt ${attempt}/${maxRetries})...`);

          // sign with Fordefi (we get a fresh blockhash for each attempt)
          const rawSignedTxBase64 = await signWithFordefi(message, solana_client.rpc);
          console.log(`[TX ${currentTx}] Signed by Fordefi MPC 🖋️✅`);

          console.log(`[TX ${currentTx}] Broadcasting...`);
          const txSignature = await solana_client.rpc.sendTransaction(
            rawSignedTxBase64 as kit.Base64EncodedWireTransaction,
            {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
              encoding: 'base64'
            }
          ).send();

          console.log(`[TX ${currentTx}] Broadcast 📡 Signature: ${txSignature}`);

          const txBytes = Buffer.from(rawSignedTxBase64, 'base64');
          const transaction = kit.getTransactionDecoder().decode(txBytes);

          return { transaction };
        } catch (error: any) {
          lastError = error;
          const errorMsg = error?.cause?.message || error?.message || '';

          if (errorMsg.includes('Blockhash not found') || errorMsg.includes('blockhash')) {
            console.log(`[TX ${currentTx}] Blockhash expired, retrying with fresh blockhash...`);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    },
  });
  // tx plan counter
  let txCount = 0;
  const countTxs = (plan: any): void => {
    if (plan.kind === 'sequential' || plan.kind === 'parallel') {
      for (const item of plan.plans) countTxs(item);
    } else if (plan.message) {
      txCount++;
    }
  };
  countTxs(transactionPlan);
  console.log(`Transaction plan contains ${txCount} transactions`);

  console.log('Executing transaction plan...');
  try {
    await transactionPlanExecutor(transactionPlan);
    console.log('Transaction plan executed ✅');
  } catch (error: any) {
    console.error('\n❌ Transaction execution failed\n');

    const getRootCause = (err: any): any => {
      let current = err;
      while (current?.cause) {
        current = current.cause;
      }
      return current;
    };

    const rootCause = getRootCause(error);
    console.error('─'.repeat(50));
    console.error('ROOT CAUSE:', rootCause?.message || 'Unknown error');
    console.error('─'.repeat(50));

    if (kit.isSolanaError(error, kit.SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN)) {
      const result = error.context.transactionPlanResult as kit.TransactionPlanResult;
      const summarizePlan = (plan: any, depth = 0): void => {
        const indent = '  '.repeat(depth);
        if (plan.kind === 'sequential' || plan.kind === 'parallel') {
          console.error(`${indent}${plan.kind.toUpperCase()} plan:`);
          for (const item of plan.plans) {
            summarizePlan(item, depth + 1);
          }
        } else if (plan.status) {
          const statusIcon = plan.status.kind === 'success' ? '✅' :
                            plan.status.kind === 'canceled' ? '⏹️' : '❌';
          const feePayer = plan.message?.feePayer?.address?.slice(0, 8) || 'unknown';
          console.error(`${indent}${statusIcon} Transaction (feePayer: ${feePayer}...): ${plan.status.kind}`);
        }
      };

      console.error('\nTransaction Plan Summary:');
      summarizePlan(result);
    }
    const findLogs = (err: any): string[] | null => {
      if (err?.context?.logs?.length > 0) return err.context.logs;
      if (err?.cause) return findLogs(err.cause);
      return null;
    };

    const logs = findLogs(error);
    if (logs && logs.length > 0) {
      console.error('\nSimulation Logs:');
      logs.forEach((log: string) => console.error(`  ${log}`));
    }

    throw error;
  }
}

if (require.main === module) {
  main();
}
