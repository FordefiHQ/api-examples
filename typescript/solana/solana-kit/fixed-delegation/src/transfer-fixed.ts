import * as kit from '@solana/kit';
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import {
  findFixedDelegationPda,
  findSubscriptionAuthorityPda,
  getTransferFixedInstruction,
} from '@solana/subscriptions';
import { fordefiConfig, delegationConfig } from './config';
import { buildFordefiTxBody, signAndSubmit } from '../utils/fordefi-submit';

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  if (!fordefiConfig.delegateeVault) {
    console.error('Error: DELEGATEE_VAULT environment variable is not set (the delegatee signs the transfer)');
    return
  }
  const delegator = kit.address(fordefiConfig.delegatorAddress);
  const delegatee = kit.address(fordefiConfig.delegateeAddress);
  const delegateeSigner = kit.createNoopSigner(delegatee);
  const tokenMint = kit.address(delegationConfig.mint);
  const receiver = kit.address(delegationConfig.receiverAddress ?? fordefiConfig.delegateeAddress);

  const [delegatorAta] = await findAssociatedTokenPda({
    owner: delegator,
    mint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [receiverAta] = await findAssociatedTokenPda({
    owner: receiver,
    mint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
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
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const transferIx = getTransferFixedInstruction({
    delegationPda,
    subscriptionAuthority: subscriptionAuthorityPda,
    delegatorAta,
    receiverAta,
    tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    delegatee: delegateeSigner,
    transferData: {
      amount: delegationConfig.transferAmount,
      delegator,
      mint: tokenMint,
    },
  });

  try {
    // The delegatee's vault signs and pays fees, no delegator signature needed
    const txBody = await buildFordefiTxBody(fordefiConfig.delegateeVault, delegatee, [createAtaIx, transferIx]);
    await signAndSubmit(fordefiConfig, txBody);
    console.log(`Pulled ${delegationConfig.transferAmount / 10 ** delegationConfig.decimals} tokens from the delegation 💸`);
  } catch (error: any) {
    console.error(`Failed to transfer from the delegation: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
