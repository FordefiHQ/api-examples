import * as kit from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from '@solana-program/token';
import {
  fetchMaybeSubscriptionAuthority,
  findFixedDelegationPda,
  findSubscriptionAuthorityPda,
  getCreateFixedDelegationInstruction,
  getInitSubscriptionAuthorityInstruction,
} from '@solana/subscriptions';
import { fordefiConfig, delegationConfig } from './config';
import { createClient } from '../utils/solana-client-util';
import { buildFordefiTxBody, signAndSubmit } from '../utils/fordefi-submit';

// Waits for the SubscriptionAuthority account to land on-chain and returns its init_id
async function waitForSubscriptionAuthorityInitId(
  subscriptionAuthorityPda: kit.Address,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<bigint> {
  const solana_client = createClient();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const authority = await fetchMaybeSubscriptionAuthority(solana_client.rpc, subscriptionAuthorityPda);
    if (authority.exists) {
      return authority.data.initId;
    }
    console.log(`Waiting for Subscription Authority account... (attempt ${attempt + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for Subscription Authority ${subscriptionAuthorityPda} to be initialized`);
}

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return
  }
  const solana_client = createClient();
  const delegator = kit.address(fordefiConfig.delegatorAddress);
  const delegatorSigner = kit.createNoopSigner(delegator);
  const delegatee = kit.address(fordefiConfig.delegateeAddress);
  const tokenMint = kit.address(delegationConfig.mint);

  const [delegatorAta] = await findAssociatedTokenPda({
    owner: delegator,
    mint: tokenMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  console.log(`Delegator ATA: ${delegatorAta}`);

  const [subscriptionAuthorityPda] = await findSubscriptionAuthorityPda({
    user: delegator,
    tokenMint,
  });
  console.log(`Subscription Authority PDA: ${subscriptionAuthorityPda}`);

  // The Subscription Authority is a one-time-per-(user, mint) setup, so we
  // only initialize it if it doesn't exist yet. It must be confirmed on-chain
  // before the delegation can be created, because create_fixed_delegation
  // validates against the authority's live init_id.
  const authority = await fetchMaybeSubscriptionAuthority(solana_client.rpc, subscriptionAuthorityPda);
  let initId: bigint;
  if (authority.exists) {
    console.log("Subscription Authority already initialized ✅");
    initId = authority.data.initId;
  } else {
    console.log("Initializing Subscription Authority...");
    const initIx = getInitSubscriptionAuthorityInstruction({
      owner: delegatorSigner,
      subscriptionAuthority: subscriptionAuthorityPda,
      tokenMint,
      userAta: delegatorAta,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const initTxBody = await buildFordefiTxBody(fordefiConfig.delegatorVault, delegator, [initIx]);
    await signAndSubmit(fordefiConfig, initTxBody);
    initId = await waitForSubscriptionAuthorityInitId(subscriptionAuthorityPda);
    console.log("Subscription Authority initialized ✅");
  }

  const [delegationPda] = await findFixedDelegationPda({
    subscriptionAuthority: subscriptionAuthorityPda,
    delegator,
    delegatee,
    nonce: delegationConfig.nonce,
  });
  console.log(`Fixed Delegation PDA: ${delegationPda}`);

  const expiryTs = delegationConfig.expiryDays === 0
    ? 0
    : Math.floor(Date.now() / 1000) + delegationConfig.expiryDays * 24 * 60 * 60;

  const createIx = getCreateFixedDelegationInstruction({
    delegator: delegatorSigner,
    subscriptionAuthority: subscriptionAuthorityPda,
    delegationAccount: delegationPda,
    delegatee,
    fixedDelegation: {
      nonce: delegationConfig.nonce,
      amount: delegationConfig.allowance,
      expiryTs,
      expectedSubscriptionAuthorityInitId: initId,
    },
  });

  try {
    const createTxBody = await buildFordefiTxBody(fordefiConfig.delegatorVault, delegator, [createIx]);
    await signAndSubmit(fordefiConfig, createTxBody);
    console.log(`Fixed delegation created: ${delegatee} can pull up to ${delegationConfig.allowance / 10 ** delegationConfig.decimals} tokens 🤝`);
  } catch (error: any) {
    console.error(`Failed to create the delegation: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
