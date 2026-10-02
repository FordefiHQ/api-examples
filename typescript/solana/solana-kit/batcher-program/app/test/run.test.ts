// The batcher program's .so is not checked in (target/ is ignored and building it needs Anchor), so
// LiteSVM cannot execute the batch instruction itself: every broadcast fails at the program with
// InvalidProgramForExecution. That failure only happens after LiteSVM's signature verification has
// passed, so these tests check the Fordefi requests, that the vault's signature is valid over the
// message Fordefi returned, and that the batch reached the program, rather than token balances.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as kit from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from '@solana-program/token';
import { LiteSVM } from 'litesvm';
import { BroadcastAttempt, Mocks, createVault, fundAccount, installMocks, prepareWorkdir, setMint, setTokenAccount } from './harness';

const TOKEN_2022_PROGRAM_ADDRESS = kit.address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const BATCHER_PROGRAM_ADDRESS = kit.address('BTCH6Wx6XdS8epLM4qZtuLeUebvBCzVPS4WAcQgPQw6t');
const vault = createVault('11111111-2222-3333-4444-555555555555');

let mocks: Mocks;
let config: typeof import('../config');
let runSameToken: typeof import('../run-with-fordefi');
let runMultiToken: typeof import('../run-multi-with-fordefi');

before(async () => {
  const apiUserPublicKey = prepareWorkdir({
    FORDEFI_API_TOKEN: 'test-token',
    FORDEFI_VAULT_ID: vault.id,
    FORDEFI_VAULT_ADDRESS: vault.address,
  });
  // Loaded only now, because the config reads the env vars and API User key at import time
  config = require('../config');
  runSameToken = require('../run-with-fordefi');
  runMultiToken = require('../run-multi-with-fordefi');

  const svm = new LiteSVM();
  fundAccount(svm, vault.address);
  // USDG is a Token-2022 mint, which the multi-token script resolves from the mint's owner
  for (const [mint, tokenProgram] of [
    [config.USDC_MINT, TOKEN_PROGRAM_ADDRESS],
    [config.USDG_MINT, TOKEN_2022_PROGRAM_ADDRESS],
  ] as const) {
    setMint(svm, mint, 6, tokenProgram);
    const [ata] = await findAssociatedTokenPda({ owner: vault.address, mint, tokenProgram });
    setTokenAccount(svm, { address: ata, mint, owner: vault.address, amount: 100_000_000n }, tokenProgram);
  }

  mocks = installMocks({ svm, vaults: [vault], apiUserPublicKey });
});

after(() => mocks.restore());

async function assertSignedByVault(attempt: BroadcastAttempt | undefined, submittedMessageBase64: string) {
  assert.ok(attempt, 'a transaction was broadcast');
  const message = kit.getCompiledTransactionMessageDecoder().decode(attempt.transaction.messageBytes);
  const submitted = kit.getCompiledTransactionMessageDecoder().decode(Buffer.from(submittedMessageBase64, 'base64'));
  assert.notEqual(message.lifetimeToken, submitted.lifetimeToken, 'Fordefi refreshed the blockhash');
  assert.equal(message.lifetimeToken, mocks.svm.latestBlockhash(), 'the broadcast carries the refreshed blockhash');
  assert.equal(message.staticAccounts[0], vault.address, 'the vault is the fee payer');
  assert.ok(message.staticAccounts.includes(BATCHER_PROGRAM_ADDRESS), 'the batch instruction is included');

  const vaultSignature = attempt.transaction.signatures[vault.address];
  assert.ok(vaultSignature);
  const publicKey = await kit.getPublicKeyFromAddress(vault.address);
  assert.ok(await kit.verifySignature(publicKey, vaultSignature, attempt.transaction.messageBytes));
  // Signature verification passed; execution stops only because the program isn't loaded
  assert.match(attempt.error ?? '', /InvalidProgramForExecution/);
}

function assertNativeRequest(pushMode: 'auto' | 'manual') {
  const request = mocks.fordefiRequests.at(-1);
  assert.equal(request?.body.type, 'solana_transaction');
  assert.equal(request?.body.vault_id, vault.id);
  assert.equal(request?.body.details.type, 'solana_serialized_transaction_message');
  assert.equal(request?.body.details.push_mode, pushMode);
  assert.equal(request?.body.details.chain, 'solana_devnet');
  assert.ok(request?.idempotenceId, 'native requests carry an x-idempotence-id');
  return request!.body.details.data as string;
}

test('same-token batch, push_to_custom_url: Fordefi signs and the script broadcasts via its RPC', async () => {
  config.fordefiConfig.push_to_custom_url = true;
  await assert.rejects(runSameToken.main());

  const submitted = assertNativeRequest('manual');
  const attempt = mocks.broadcastAttempts.at(-1);
  assert.equal(attempt?.host, 'api.devnet.solana.com');
  await assertSignedByVault(attempt, submitted);
});

test('same-token batch, auto push: Fordefi signs and broadcasts', async () => {
  config.fordefiConfig.push_to_custom_url = false;
  // Fordefi reports the failed broadcast, which the signer surfaces as an unconfirmed outcome
  await assert.rejects(runSameToken.main(), /outcome could not be confirmed/);

  const submitted = assertNativeRequest('auto');
  const attempt = mocks.broadcastAttempts.at(-1);
  assert.equal(attempt?.host, 'api.fordefi.com');
  await assertSignedByVault(attempt, submitted);
});

test('multi-token batch, push_to_custom_url: Fordefi signs and the script broadcasts via its RPC', async () => {
  config.fordefiConfig.push_to_custom_url = true;
  await assert.rejects(runMultiToken.main());

  const submitted = assertNativeRequest('manual');
  const attempt = mocks.broadcastAttempts.at(-1);
  assert.equal(attempt?.host, 'api.devnet.solana.com');
  await assertSignedByVault(attempt, submitted);
  const message = kit.getCompiledTransactionMessageDecoder().decode(attempt!.transaction.messageBytes);
  assert.ok(message.staticAccounts.includes(TOKEN_2022_PROGRAM_ADDRESS), 'the Token-2022 program was resolved for USDG');
});
