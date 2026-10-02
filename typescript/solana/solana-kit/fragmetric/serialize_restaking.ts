import { FordefiSolanaConfig, FragmetricConfig } from "./config";
import { solanaCluster } from './config'
import * as kit from '@solana/kit';

export async function getDepositInstructions(fordefiConfig: FordefiSolanaConfig, fragmetricConfig: FragmetricConfig): Promise<kit.Instruction[]> {
    const FragmetricSDK = await import('@fragmetric-labs/sdk');
    try {
        const { RestakingProgram } = FragmetricSDK as any;
        const restaking =  await RestakingProgram.mainnet(solanaCluster);

        await restaking.resolve();

        const tx = await restaking.fragSOL
            .user(fordefiConfig.fordefiSolanaVaultAddress)
            .deposit.assemble(
                {
                    assetMint: fragmetricConfig.assetMint,
                    assetAmount: fragmetricConfig.restakeAmount,
                    applyPresetComputeUnitLimit: true,
                },
                {
                    recentBlockhash: null,
                }
            );

        console.log("Deposit transaction assembled:", tx);
        return tx.instructions;

    } catch (error) {
        console.error("Error creating restaking transaction:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to create restaking transaction: ${errorMessage}`);
    }
}

// The SDK marks the vault as a signer with its own no-op signer. Kit rejects two different
// signer objects for the same address, so the Fordefi signer takes its place in every account meta
function useVaultSigner(instructions: kit.Instruction[], vaultSigner: kit.TransactionSigner): kit.Instruction[] {
    return instructions.map(instruction => ({
        ...instruction,
        accounts: instruction.accounts?.map(account =>
            'signer' in account && account.address === vaultSigner.address
                ? { ...account, signer: vaultSigner }
                : account
        ),
    }));
}

// The vault signer is the Fordefi signer from @solana/keychain-fordefi: Kit asks it to sign
// (and, in auto push mode, broadcast) when the message is signed
export async function createTxMessage(
    vaultSigner: kit.TransactionSigner,
    rpc: kit.Rpc<kit.GetLatestBlockhashApi>,
    instructions: kit.Instruction[]
) {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const txMessage = kit.pipe(
        kit.createTransactionMessage({ version: 0 }),
        message => kit.setTransactionMessageFeePayerSigner(vaultSigner, message),
        message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
        message => kit.appendTransactionMessageInstructions(useVaultSigner(instructions, vaultSigner), message)
      );
    console.log("Tx message: ", txMessage)

    return txMessage;
}
