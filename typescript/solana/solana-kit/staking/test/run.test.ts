import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as kit from '@solana/kit';
import { getCreateAccountInstruction } from '@solana-program/system';
import { STAKE_PROGRAM_ADDRESS } from '@solana-program/stake';
import { LiteSVM } from 'litesvm';
import { Mocks, createVault, fundAccount, installMocks, prepareWorkdir } from './harness';

const VOTE_PROGRAM_ADDRESS = kit.address('Vote111111111111111111111111111111111111111');
const VOTE_STATE_SIZE = 3762n;
const U64_MAX = 2n ** 64n - 1n;

// StakeStateV2::Stake layout: u32 tag, then Meta (120 bytes), then Delegation
const VOTER_OFFSET = 4 + 120;
const DEACTIVATION_EPOCH_OFFSET = VOTER_OFFSET + 32 + 8 + 8;

const vault = createVault('11111111-2222-3333-4444-555555555555');

let mocks: Mocks;
let voteAccount: kit.Address;
let stakeAccount: kit.Address;
let run: typeof import('../src/run');
let config: typeof import('../src/config');

/** Create and initialize a real vote account, so the stake program can delegate to it. */
async function createVoteAccount(svm: LiteSVM): Promise<kit.Address> {
  const [payer, vote, node] = await Promise.all([
    kit.generateKeyPairSigner(),
    kit.generateKeyPairSigner(),
    kit.generateKeyPairSigner(),
  ]);
  fundAccount(svm, payer.address);

  // VoteInstruction::InitializeAccount(VoteInit { node_pubkey, authorized_voter, authorized_withdrawer, commission })
  const addressEncoder = kit.getAddressEncoder();
  const initializeData = new Uint8Array(4 + 32 * 3 + 1);
  initializeData.set(addressEncoder.encode(node.address), 4);
  initializeData.set(addressEncoder.encode(node.address), 36);
  initializeData.set(addressEncoder.encode(node.address), 68);
  const initializeIx: kit.Instruction = {
    programAddress: VOTE_PROGRAM_ADDRESS,
    accounts: [
      { address: vote.address, role: kit.AccountRole.WRITABLE },
      { address: kit.address('SysvarRent111111111111111111111111111111111'), role: kit.AccountRole.READONLY },
      { address: kit.address('SysvarC1ock11111111111111111111111111111111'), role: kit.AccountRole.READONLY },
      { address: node.address, role: kit.AccountRole.READONLY_SIGNER, signer: node } as kit.AccountMeta,
    ],
    data: initializeData,
  };

  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    m => kit.setTransactionMessageFeePayerSigner(payer, m),
    m => kit.setTransactionMessageLifetimeUsingBlockhash({ blockhash: svm.latestBlockhash(), lastValidBlockHeight: 0n }, m),
    m => kit.appendTransactionMessageInstructions([
      getCreateAccountInstruction({
        payer,
        newAccount: vote,
        lamports: svm.minimumBalanceForRentExemption(VOTE_STATE_SIZE),
        space: VOTE_STATE_SIZE,
        programAddress: VOTE_PROGRAM_ADDRESS,
      }),
      initializeIx,
    ], m),
  );
  const result = svm.sendTransaction(await kit.signTransactionMessageWithSigners(message));
  assert.ok(!('err' in result), `vote account setup failed: ${result.toString()}`);
  return vote.address;
}

function stakeData(): Buffer {
  const account = mocks.svm.getAccount(stakeAccount);
  assert.ok(account.exists, 'stake account exists');
  return Buffer.from(account.data);
}

before(async () => {
  const svm = new LiteSVM();
  fundAccount(svm, vault.address);
  voteAccount = await createVoteAccount(svm);

  const apiUserPublicKey = prepareWorkdir({
    FORDEFI_API_TOKEN: 'test-token',
    FORDEFI_VAULT_ID: vault.id,
    FORDEFI_VAULT_ADDRESS: vault.address,
    VALIDATOR_ADDRESS: voteAccount,
    ACTION: 'stake',
  });

  mocks = installMocks({ svm, vaults: [vault], apiUserPublicKey });
  // Loaded only now, because the config reads the env vars and API User key at import time
  config = require('../src/config');
  run = require('../src/run');
});

after(() => mocks.restore());

test('stake: creates a stake account delegated to the validator', async () => {
  await run.main();

  const [request] = mocks.fordefiRequests;
  assert.equal(request?.body.type, 'solana_transaction');
  assert.equal(request?.body.vault_id, vault.id);
  assert.equal(request?.body.details.type, 'solana_serialized_transaction_message');
  assert.equal(request?.body.details.push_mode, 'auto');
  assert.equal(request?.body.details.chain, 'solana_mainnet');
  assert.ok(request?.idempotenceId, 'native requests carry an x-idempotence-id');
  assert.deepEqual(mocks.sentTransactions.map(t => t.host), ['api.fordefi.com']);

  const stakeAccounts = mocks.svm.getProgramAccounts(STAKE_PROGRAM_ADDRESS);
  assert.equal(stakeAccounts.length, 1);
  stakeAccount = stakeAccounts[0]!.address;

  const data = stakeData();
  assert.equal(data.readUInt32LE(0), 2, 'stake account is in the delegated (Stake) state');
  assert.equal(kit.getAddressDecoder().decode(data.subarray(VOTER_OFFSET, VOTER_OFFSET + 32)), voteAccount);
  assert.equal(data.readBigUInt64LE(DEACTIVATION_EPOCH_OFFSET), U64_MAX);
});

test('stake: an amount below the minimum delegation is rejected before anything reaches Fordefi', async () => {
  const configured = config.fordefiConfig.amountToStake;
  config.fordefiConfig.amountToStake = '0.001';
  try {
    await run.main();
  } finally {
    config.fordefiConfig.amountToStake = configured;
  }

  assert.equal(mocks.fordefiRequests.length, 1, 'no new Fordefi request');
  assert.equal(mocks.svm.getProgramAccounts(STAKE_PROGRAM_ADDRESS).length, 1, 'no new stake account');
});

test('unstake: deactivates the stake account', async () => {
  config.fordefiConfig.action = 'unstake';
  config.fordefiConfig.stakeAccountAddress = stakeAccount;
  await run.main();

  assert.equal(mocks.fordefiRequests.length, 2);
  assert.equal(mocks.sentTransactions.length, 2);
  assert.notEqual(stakeData().readBigUInt64LE(DEACTIVATION_EPOCH_OFFSET), U64_MAX, 'deactivation epoch is set');
});

test('withdraw: returns the whole stake account balance to the vault', async () => {
  const stakeLamports = mocks.svm.getBalance(stakeAccount)!;
  const vaultLamportsBefore = mocks.svm.getBalance(vault.address)!;

  // Stake deactivated in the epoch it was activated in is withdrawable right away
  config.fordefiConfig.action = 'withdraw';
  await run.main();

  assert.equal(mocks.fordefiRequests.length, 3);
  assert.equal(mocks.sentTransactions.length, 3);
  assert.ok(!mocks.svm.getAccount(stakeAccount).exists, 'stake account is emptied and closed');
  // the vault also paid the 5000 lamport fee
  assert.equal(mocks.svm.getBalance(vault.address)!, vaultLamportsBefore + stakeLamports - 5000n);
});
