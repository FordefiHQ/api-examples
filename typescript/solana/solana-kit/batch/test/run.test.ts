import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as kit from '@solana/kit';
import { findAssociatedTokenPda } from '@solana-program/token';
import { LiteSVM } from 'litesvm';
import { Mocks, createVault, fundAccount, installMocks, prepareWorkdir, setMint, setTokenAccount, tokenBalance } from './harness';

// The configured mint: USDG, a Token-2022 mint
const USDG = kit.address('2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH');
const TOKEN_2022 = kit.address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const vault = createVault('11111111-2222-3333-4444-555555555555');
const destination = createVault('unused-1').address;
const destination2 = createVault('unused-2').address;

let mocks: Mocks;
let run: typeof import('../src/run');
let config: typeof import('../src/config');

const ataOf = async (owner: kit.Address) =>
  (await findAssociatedTokenPda({ owner, mint: USDG, tokenProgram: TOKEN_2022 }))[0];

before(async () => {
  const apiUserPublicKey = prepareWorkdir({
    FORDEFI_API_TOKEN: 'test-token',
    FORDEFI_VAULT_ID: vault.id,
    FORDEFI_VAULT_ADDRESS: vault.address,
    DESTINATION_ADDRESS: destination,
    DESTINATION_ADDRESS_2: destination2,
  });

  const svm = new LiteSVM();
  fundAccount(svm, vault.address);
  setMint(svm, USDG, 6, TOKEN_2022);
  setTokenAccount(svm, { address: await ataOf(vault.address), mint: USDG, owner: vault.address, amount: 1_000_000n }, TOKEN_2022);

  mocks = installMocks({ svm, vaults: [vault], apiUserPublicKey });
  // Loaded only now, because the config reads the env vars and API User key at import time
  config = require('../src/config');
  run = require('../src/run');
});

after(() => mocks.restore());

test('plan executor: Fordefi signs in manual mode and the batch is broadcast via the configured RPC', async () => {
  await run.main();

  assert.equal(mocks.fordefiRequests.length, 1, 'the batch fits in one transaction');
  const [request] = mocks.fordefiRequests;
  assert.equal(request?.body.type, 'solana_transaction');
  assert.equal(request?.body.vault_id, vault.id);
  assert.equal(request?.body.details.type, 'solana_serialized_transaction_message');
  assert.equal(request?.body.details.push_mode, 'manual');
  assert.equal(request?.body.details.chain, 'solana_mainnet');
  assert.ok(request?.idempotenceId, 'native requests carry an x-idempotence-id');

  assert.deepEqual(mocks.sentTransactions.map(t => t.host), ['api.mainnet-beta.solana.com']);
  const amount = BigInt(config.fordefiConfig.amount);
  assert.equal(tokenBalance(mocks.svm, await ataOf(destination)), amount);
  assert.equal(tokenBalance(mocks.svm, await ataOf(destination2)), amount);
  assert.equal(tokenBalance(mocks.svm, await ataOf(vault.address)), 1_000_000n - 2n * amount);
});
