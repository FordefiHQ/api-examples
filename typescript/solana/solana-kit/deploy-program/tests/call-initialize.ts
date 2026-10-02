import * as kit from '@solana/kit';
import { fordefiConfig } from '../src/config';
import { createClient } from '../src/utils/solana-client-util';
import { getInitializeInstruction } from '../clients/js/src/generated/instructions/initialize';

describe('it creates a new counter account', () => {
    it("Is initialized!", async () => {
        try {
            // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
            const { createFordefiSigner } = await import('@solana/keychain-fordefi');
            // Auto push mode: Fordefi signs and broadcasts the transaction
            const deployerVaultSigner = await createFordefiSigner({
                accessToken: fordefiConfig.accessToken,
                vaultId: fordefiConfig.deployerVaultId,
                publicKey: fordefiConfig.deployerVaultAddress,
                privateKeyPem: fordefiConfig.privateKeyPem,
                chain: fordefiConfig.chain,
            });

            const { value: latestBlockhash } = await createClient().rpc.getLatestBlockhash().send();
            const message = kit.pipe(
                kit.createTransactionMessage({ version: 0 }),
                msg => kit.setTransactionMessageFeePayerSigner(deployerVaultSigner, msg),
                msg => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
                msg => kit.appendTransactionMessageInstructions([getInitializeInstruction()], msg),
            );

            const signature = kit.getBase58Decoder().decode(await kit.signAndSendTransactionMessageWithSigners(message));
            console.log("Transaction signed and broadcast by Fordefi ✅");
            console.log(`Link to explorer:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`);
        } catch (error: any) {
            console.error(`Failed to sign the transaction: ${error.message}`);
        }
    });
})
