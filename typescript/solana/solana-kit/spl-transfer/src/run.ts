import * as kit from '@solana/kit';
import { fordefiConfig, transferConfig } from './config';
import { createTxMessage } from './serialize-spl-transfer';
import { createClient } from '../utils/solana-client-util';
import { pushToJito } from '../utils/push_to_jito';


export async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  const solana_client = createClient();

  // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
  const { createFordefiSigner } = await import('@solana/keychain-fordefi');
  const signerConfig = {
    accessToken: fordefiConfig.accessToken,
    vaultId: fordefiConfig.originVault,
    publicKey: fordefiConfig.originAddress,
    privateKeyPem: fordefiConfig.privateKeyPem,
    chain: fordefiConfig.chain,
  };

  try {
    if (transferConfig.useJito) {
      // Manual push mode: Fordefi signs the transaction without broadcasting it, so we can push it to Jito.
      // Fordefi may refresh the blockhash and fees, so we always broadcast the transaction it returns.
      const vaultSigner = await createFordefiSigner({ ...signerConfig, pushMode: 'manual' });
      const txMessage = await createTxMessage(vaultSigner, solana_client.rpc, fordefiConfig.destAddress, transferConfig);
      const signedTx = await kit.signTransactionMessageWithSigners(txMessage);
      console.log(`Transaction signed by source vault 🖋️✅\nSignature: ${kit.getSignatureFromTransaction(signedTx)}`);

      await pushToJito(kit.getBase64EncodedWireTransaction(signedTx));
    } else {
      // Auto push mode: Fordefi signs the transaction and broadcasts it to the network
      const vaultSigner = await createFordefiSigner(signerConfig);
      const txMessage = await createTxMessage(vaultSigner, solana_client.rpc, fordefiConfig.destAddress, transferConfig);
      const signature = await kit.signAndSendTransactionMessageWithSigners(txMessage);

      console.log("Transaction signed by source vault and submitted to network 📡");
      console.log(`Signature: ${kit.getBase58Decoder().decode(signature)}`);
    }
  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
