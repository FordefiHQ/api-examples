import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as kit from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from '@solana-program/token';
import { LiteSVM } from 'litesvm';
import { Mocks, createVault, fundAccount, installMocks, prepareWorkdir, setMint, setTokenAccount, tokenBalance } from './harness';

// The configured mint, USDG, is a Token-2022 mint; USDC covers the classic SPL Token program
const USDG = kit.address('2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH');
const USDC = kit.address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const TOKEN_2022 = kit.address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const vault = createVault('11111111-2222-3333-4444-555555555555');
const destination = createVault('unused').address;

let mocks: Mocks;
let run: typeof import('../src/run');
let config: typeof import('../src/config');

const ataOf = async (owner: kit.Address, mint: kit.Address, tokenProgram: kit.Address) =>
  (await findAssociatedTokenPda({ owner, mint, tokenProgram }))[0];

before(async () => {
  const apiUserPublicKey = prepareWorkdir({
    FORDEFI_API_TOKEN: 'test-token',
    FORDEFI_VAULT_ID: vault.id,
    FORDEFI_VAULT_ADDRESS: vault.address,
    DESTINATION_ADDRESS: destination,
  });

  const svm = new LiteSVM();
  fundAccount(svm, vault.address);
  for (const [mint, tokenProgram] of [[USDG, TOKEN_2022], [USDC, TOKEN_PROGRAM_ADDRESS]] as const) {
    setMint(svm, mint, 6, tokenProgram);
    const sourceAta = await ataOf(vault.address, mint, tokenProgram);
    setTokenAccount(svm, { address: sourceAta, mint, owner: vault.address, amount: 1_000_000n }, tokenProgram);
  }

  mocks = installMocks({ svm, vaults: [vault], apiUserPublicKey });
  // Loaded only now, because the config reads the env vars and API User key at import time
  config = require('../src/config');
  run = require('../src/run');
});

after(() => mocks.restore());

test('auto push mode: Fordefi signs and broadcasts the transfer', async () => {
  assert.equal(config.transferConfig.mint, USDG);
  await run.main();

  const [request] = mocks.fordefiRequests;
  assert.equal(request?.body.type, 'solana_transaction');
  assert.equal(request?.body.vault_id, vault.id);
  assert.equal(request?.body.details.type, 'solana_serialized_transaction_message');
  assert.equal(request?.body.details.push_mode, 'auto');
  assert.equal(request?.body.details.chain, 'solana_mainnet');
  assert.ok(request?.idempotenceId, 'native requests carry an x-idempotence-id');

  assert.deepEqual(mocks.sentTransactions.map(t => t.host), ['api.fordefi.com']);
  const destAta = await ataOf(destination, USDG, TOKEN_2022);
  assert.equal(tokenBalance(mocks.svm, destAta), BigInt(config.transferConfig.amount));
});

test('Jito mode: Fordefi signs without broadcasting and the example pushes to Jito', async () => {
  config.transferConfig.useJito = true;
  await run.main();

  assert.equal(mocks.fordefiRequests.at(-1)?.body.details.push_mode, 'manual');
  assert.equal(mocks.sentTransactions.at(-1)?.host, 'mainnet.block-engine.jito.wtf');
  const destAta = await ataOf(destination, USDG, TOKEN_2022);
  assert.equal(tokenBalance(mocks.svm, destAta), 2n * BigInt(config.transferConfig.amount));
});

test('classic SPL Token mint: the token program is resolved from the mint', async () => {
  config.transferConfig.useJito = false;
  config.transferConfig.mint = USDC;
  await run.main();

  const destAta = await ataOf(destination, USDC, TOKEN_PROGRAM_ADDRESS);
  assert.equal(tokenBalance(mocks.svm, destAta), BigInt(config.transferConfig.amount));
});
