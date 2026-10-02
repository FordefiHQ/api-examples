import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as kit from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from '@solana-program/token';
import {
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
  fetchMaybeFixedDelegation,
  fetchMaybeSubscriptionAuthority,
  findFixedDelegationPda,
  findSubscriptionAuthorityPda,
} from '@solana/subscriptions';
import { LiteSVM } from 'litesvm';
import { PROGRAM_PATH } from './fetch-program';
import { Mocks, createVault, fundAccount, installMocks, prepareWorkdir, setMint, setTokenAccount, tokenBalance } from './harness';

const USDC = kit.address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const delegatorVault = createVault('11111111-1111-1111-1111-111111111111');
const delegateeVault = createVault('22222222-2222-2222-2222-222222222222');
const DELEGATOR_BALANCE = 5_000_000n;

let mocks: Mocks;
let config: typeof import('../src/config');
let createDelegation: typeof import('../src/create-delegation');
let transferFixed: typeof import('../src/transfer-fixed');
let revokeDelegation: typeof import('../src/revoke-delegation');
// Reads go through the mocked fetch, so this is served by LiteSVM
const rpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');
let delegationPda: kit.Address;

const ataOf = async (owner: kit.Address) =>
  (await findAssociatedTokenPda({ owner, mint: USDC, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];

before(async () => {
  const apiUserPublicKey = prepareWorkdir({
    FORDEFI_API_TOKEN: 'test-token',
    DELEGATOR_VAULT_ID: delegatorVault.id,
    DELEGATOR_VAULT_ADDRESS: delegatorVault.address,
    DELEGATEE_VAULT_ID: delegateeVault.id,
    DELEGATEE_VAULT_ADDRESS: delegateeVault.address,
  });

  const svm = new LiteSVM();
  // The real, deployed Subscriptions program (cached by the pretest script)
  svm.addProgram(SUBSCRIPTIONS_PROGRAM_ADDRESS, fs.readFileSync(PROGRAM_PATH));
  fundAccount(svm, delegatorVault.address);
  fundAccount(svm, delegateeVault.address);
  setMint(svm, USDC, 6);
  setTokenAccount(svm, { address: await ataOf(delegatorVault.address), mint: USDC, owner: delegatorVault.address, amount: DELEGATOR_BALANCE });

  mocks = installMocks({ svm, vaults: [delegatorVault, delegateeVault], apiUserPublicKey });
  // Loaded only now, because the config reads the env vars and API User key at import time
  config = require('../src/config');
  createDelegation = require('../src/create-delegation');
  transferFixed = require('../src/transfer-fixed');
  revokeDelegation = require('../src/revoke-delegation');

  const [subscriptionAuthority] = await findSubscriptionAuthorityPda({ user: delegatorVault.address, tokenMint: USDC });
  [delegationPda] = await findFixedDelegationPda({
    subscriptionAuthority,
    delegator: delegatorVault.address,
    delegatee: delegateeVault.address,
    nonce: config.delegationConfig.nonce,
  });
});

after(() => mocks.restore());

test('create-delegation: the delegator vault initializes the Subscription Authority, then creates the delegation', async () => {
  await createDelegation.main();

  assert.equal(mocks.fordefiRequests.length, 2, 'one transaction for the authority, one for the delegation');
  for (const { body, idempotenceId } of mocks.fordefiRequests) {
    assert.equal(body.type, 'solana_transaction');
    assert.equal(body.vault_id, delegatorVault.id);
    assert.equal(body.details.type, 'solana_serialized_transaction_message');
    assert.equal(body.details.push_mode, 'auto');
    assert.equal(body.details.chain, 'solana_mainnet');
    assert.ok(idempotenceId, 'native requests carry an x-idempotence-id');
  }
  assert.deepEqual(mocks.sentTransactions.map(t => t.host), ['api.fordefi.com', 'api.fordefi.com']);

  const [subscriptionAuthority] = await findSubscriptionAuthorityPda({ user: delegatorVault.address, tokenMint: USDC });
  assert.ok((await fetchMaybeSubscriptionAuthority(rpc, subscriptionAuthority)).exists);
  const delegation = await fetchMaybeFixedDelegation(rpc, delegationPda);
  assert.ok(delegation.exists, 'fixed delegation PDA was created');
  assert.equal(delegation.data.amount, BigInt(config.delegationConfig.allowance));
});

test('create-delegation: a second run reuses the existing Subscription Authority', async () => {
  // Creating the same delegation again must fail on-chain, but only one transaction is attempted
  await createDelegation.main();
  assert.equal(mocks.fordefiRequests.length, 3);
  assert.equal(mocks.sentTransactions.length, 2, 'the duplicate delegation is rejected');
});

test('transfer: the delegatee vault pulls from the delegation without the delegator signing', async () => {
  await transferFixed.main();

  const request = mocks.fordefiRequests.at(-1)!;
  assert.equal(request.body.vault_id, delegateeVault.id);
  assert.equal(mocks.sentTransactions.length, 3);

  const transferAmount = BigInt(config.delegationConfig.transferAmount);
  assert.equal(tokenBalance(mocks.svm, await ataOf(delegateeVault.address)), transferAmount);
  assert.equal(tokenBalance(mocks.svm, await ataOf(delegatorVault.address)), DELEGATOR_BALANCE - transferAmount);
  const delegation = await fetchMaybeFixedDelegation(rpc, delegationPda);
  assert.ok(delegation.exists);
  assert.equal(delegation.data.amount, BigInt(config.delegationConfig.allowance) - transferAmount, 'allowance is reduced');
});

test('revoke: the delegator vault closes the delegation', async () => {
  await revokeDelegation.main();

  assert.equal(mocks.fordefiRequests.at(-1)?.body.vault_id, delegatorVault.id);
  assert.equal(mocks.sentTransactions.length, 4);
  assert.ok(!(await fetchMaybeFixedDelegation(rpc, delegationPda)).exists, 'delegation PDA is closed');
});
