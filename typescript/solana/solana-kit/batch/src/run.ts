import * as kit from '@solana/kit';
import { fordefiConfig } from './config';
import { createTxPlan } from './tx-planner';
import { createClient, Client } from "./solana-client-util";

export async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  const solana_client: Client = await createClient();

  // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
  const { createFordefiSigner } = await import('@solana/keychain-fordefi');
  // Manual push mode: Fordefi signs without broadcasting, so the plan executor pushes the tx to our own RPC
  const vaultSigner = await createFordefiSigner({
    accessToken: fordefiConfig.accessToken,
    vaultId: fordefiConfig.originVault,
    publicKey: fordefiConfig.originAddress,
    privateKeyPem: fordefiConfig.privateKeyPem,
    chain: fordefiConfig.chain,
    pushMode: 'manual',
  });
  const transactionPlan = await createTxPlan(fordefiConfig, vaultSigner, solana_client.rpc);

  // Create executor that uses Fordefi for signing
  const transactionPlanExecutor = kit.createTransactionPlanExecutor({
    executeTransactionMessage: async (
      context,
      message: kit.TransactionMessage & kit.TransactionMessageWithFeePayer,
    ) => {
      const { value: latestBlockhash } = await solana_client.rpc.getLatestBlockhash().send();
      const messageWithBlockhash = kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);

      console.log('Signing transaction with Fordefi...');
      // Fordefi may refresh the blockhash and fees before signing, so we broadcast the transaction it returns
      const transaction = await kit.signTransactionMessageWithSigners(messageWithBlockhash);
      context.transaction = transaction;
      console.log('Transaction signed by Fordefi MPC 🖋️✅');

      // Broadcast via RPC directly (the transaction is already fully signed)
      console.log('Broadcasting transaction...');
      const txSignature = await solana_client.rpc.sendTransaction(
        kit.getBase64EncodedWireTransaction(transaction),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          encoding: 'base64'
        }
      ).send();

      console.log(`Transaction broadcast📡\nSignature: ${txSignature}`);

      return { signature: txSignature, transaction };
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
