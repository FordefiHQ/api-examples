import * as kit from '@solana/kit';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import {
  findFixedDelegationPda,
  findSubscriptionAuthorityPda,
  getTransferFixedInstructionAsync,
} from '@solana/subscriptions';
import { fordefiConfig, delegationConfig } from './config';
import { createClient } from '../utils/solana-client-util';
import { createVaultSigner, signAndSend } from '../utils/fordefi-submit';
import { getTokenProgramForMint } from '../utils/token-program';

export async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  if (!fordefiConfig.delegateeVault) {
    console.error('Error: DELEGATEE_VAULT_ID environment variable is not set (the delegatee signs the transfer)');
    return
  }
  try {
    // The delegatee's vault signs and pays fees, no delegator signature needed
    const delegateeSigner = await createVaultSigner(fordefiConfig, fordefiConfig.delegateeVault, fordefiConfig.delegateeAddress);
    const delegatee = delegateeSigner.address;
    const delegator = kit.address(fordefiConfig.delegatorAddress);
    const tokenMint = kit.address(delegationConfig.mint);
    const receiver = kit.address(delegationConfig.receiverAddress ?? fordefiConfig.delegateeAddress);
    const tokenProgram = await getTokenProgramForMint(createClient().rpc, tokenMint);

    const [delegatorAta] = await findAssociatedTokenPda({
      owner: delegator,
      mint: tokenMint,
      tokenProgram,
    });
    const [receiverAta] = await findAssociatedTokenPda({
      owner: receiver,
      mint: tokenMint,
      tokenProgram,
    });
    console.log(`Delegator ATA: ${delegatorAta}`);
    console.log(`Receiver ATA: ${receiverAta}`);

    const [subscriptionAuthorityPda] = await findSubscriptionAuthorityPda({
      user: delegator,
      tokenMint,
    });
    const [delegationPda] = await findFixedDelegationPda({
      subscriptionAuthority: subscriptionAuthorityPda,
      delegator,
      delegatee,
      nonce: delegationConfig.nonce,
    });
    console.log(`Fixed Delegation PDA: ${delegationPda}`);

    // create the receiver's ATA if it doesn't exist
    const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      payer: delegateeSigner,
      owner: receiver,
      mint: tokenMint,
      ata: receiverAta,
      tokenProgram,
    });

    // Async variant derives the program's event-authority PDA for us
    const transferIx = await getTransferFixedInstructionAsync({
      delegationPda,
      subscriptionAuthority: subscriptionAuthorityPda,
      delegatorAta,
      receiverAta,
      tokenMint,
      tokenProgram,
      delegatee: delegateeSigner,
      transferData: {
        amount: delegationConfig.transferAmount,
        delegator,
        mint: tokenMint,
      },
    });

    await signAndSend(delegateeSigner, [createAtaIx, transferIx]);
    console.log(`Pulled ${delegationConfig.transferAmount / 10 ** delegationConfig.decimals} tokens from the delegation 💸`);
  } catch (error: any) {
    console.error(`Failed to transfer from the delegation: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
