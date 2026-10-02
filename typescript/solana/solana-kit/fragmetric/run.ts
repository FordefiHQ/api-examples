import * as kit from '@solana/kit';
import { fordefiConfig, fragmetricConfig, solanaCluster } from './config';
import { createTxMessage, getDepositInstructions } from './serialize_restaking'

// Fragmetric's SDK reads mainnet state to build the deposit, so the tests pass in their own instructions
export async function main(buildInstructions = getDepositInstructions): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  const rpc = kit.createSolanaRpc(solanaCluster);

  // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
  const { createFordefiSigner } = await import('@solana/keychain-fordefi');
  // Auto push mode: Fordefi signs the transaction and broadcasts it to the network
  const vaultSigner = await createFordefiSigner({
    accessToken: fordefiConfig.accessToken,
    vaultId: fordefiConfig.vaultId,
    publicKey: fordefiConfig.fordefiSolanaVaultAddress,
    privateKeyPem: fordefiConfig.privateKeyPem,
    chain: fordefiConfig.chain,
  });

  try {
    // Create the restaking tx
    const instructions = await buildInstructions(fordefiConfig, fragmetricConfig);
    const txMessage = await createTxMessage(vaultSigner, rpc, instructions);

    const signature = await kit.signAndSendTransactionMessageWithSigners(txMessage);
    console.log("Restaking transaction signed by vault and submitted to network 📡");
    console.log(`Signature: ${kit.getBase58Decoder().decode(signature)}`);

  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
