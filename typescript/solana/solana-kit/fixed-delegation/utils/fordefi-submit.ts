import * as kit from '@solana/kit';
import { createClient } from './solana-client-util';
import { FordefiSolanaConfig } from '../src/config';

// One of the example's Fordefi vaults as a Kit signer, backed by @solana/keychain-fordefi.
// Auto push mode: Fordefi signs each transaction and broadcasts it to the network.
export async function createVaultSigner(fordefiConfig: FordefiSolanaConfig, vaultId: string, vaultAddress: string) {
  // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
  const { createFordefiSigner } = await import('@solana/keychain-fordefi');
  return await createFordefiSigner({
    accessToken: fordefiConfig.accessToken,
    vaultId,
    publicKey: vaultAddress,
    privateKeyPem: fordefiConfig.privateKeyPem,
    chain: fordefiConfig.chain,
  });
}

// Builds a transaction paid for and signed by the vault, then has Fordefi sign and broadcast it.
// Use the vault signer in the instructions too, wherever the vault is a signer.
export async function signAndSend(vaultSigner: kit.TransactionSigner, ixes: kit.Instruction[]): Promise<string> {
  const solana_client = createClient();
  const { value: latestBlockhash } = await solana_client.rpc.getLatestBlockhash().send();

  const txMessage = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    message => kit.setTransactionMessageFeePayerSigner(vaultSigner, message),
    message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
    message => kit.appendTransactionMessageInstructions(ixes, message)
  );

  const signature = kit.getBase58Decoder().decode(await kit.signAndSendTransactionMessageWithSigners(txMessage));
  console.log("Transaction signed by vault and submitted to network 📡");
  console.log(`Signature: ${signature}`);

  return signature;
}
