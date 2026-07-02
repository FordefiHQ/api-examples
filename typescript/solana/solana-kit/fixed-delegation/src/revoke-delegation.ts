import * as kit from '@solana/kit';
import {
  findFixedDelegationPda,
  findSubscriptionAuthorityPda,
  getRevokeDelegationInstruction,
} from '@solana/subscriptions';
import { fordefiConfig, delegationConfig } from './config';
import { buildFordefiTxBody, signAndSubmit } from '../utils/fordefi-submit';

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  const delegator = kit.address(fordefiConfig.delegatorAddress);
  const delegatorSigner = kit.createNoopSigner(delegator);
  const delegatee = kit.address(fordefiConfig.delegateeAddress);
  const tokenMint = kit.address(delegationConfig.mint);

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

  // Revoking closes the delegation PDA and returns its rent to the delegator
  const revokeIx = getRevokeDelegationInstruction({
    authority: delegatorSigner,
    delegationAccount: delegationPda,
  });

  try {
    const txBody = await buildFordefiTxBody(fordefiConfig.delegatorVault, delegator, [revokeIx]);
    await signAndSubmit(fordefiConfig, txBody);
    console.log("Delegation revoked ✂️");
  } catch (error: any) {
    console.error(`Failed to revoke the delegation: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
