import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';


// The deployer vault as a Kit signer, backed by @solana/keychain-fordefi.
// Manual push mode: Fordefi signs without broadcasting, so the plan executor can co-sign with the
// local buffer/program keypairs and push each transaction to our own RPC.
export async function createDeployerVaultSigner(fordefiConfig: FordefiSolanaConfig, customFeeLamports?: string) {
  // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
  const { createFordefiSigner } = await import('@solana/keychain-fordefi');

  return await createFordefiSigner({
    accessToken: fordefiConfig.accessToken,
    vaultId: fordefiConfig.deployerVaultId,
    publicKey: fordefiConfig.deployerVaultAddress,
    privateKeyPem: fordefiConfig.privateKeyPem,
    chain: fordefiConfig.chain,
    pushMode: 'manual',
    // we MUST set custom fees we calculate or Fordefi will overshoot the fee
    fee: { type: 'custom', unit_price: customFeeLamports || fordefiConfig.defaultFeeLamports },
  });
}

export async function signWithFordefi(
  message: kit.TransactionMessage & kit.TransactionMessageWithFeePayer,
  rpc: ReturnType<typeof kit.createSolanaRpc>
) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const messageWithBlockhash = kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);

  // Kit runs the Fordefi vault signer first: Fordefi may rewrite the message (blockhash, compute budget)
  // before signing it, and the local keypair signers then sign the message Fordefi returned
  const signedTx = await kit.signTransactionMessageWithSigners(messageWithBlockhash);
  console.log(`Signed by Fordefi MPC and local signers, signature: ${kit.getSignatureFromTransaction(signedTx)}`);

  return signedTx;
}
