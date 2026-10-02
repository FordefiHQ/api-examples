import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as kit from '@solana/kit';
import { LOADER_V3_PROGRAM_ADDRESS } from '@solana-program/loader-v3';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import { Mocks, createVault, fundAccount, installMocks, prepareWorkdir } from './harness';

// LiteSVM bundles SPL Memo v3 as a raw ELF under the non-upgradeable loader, which makes it a small,
// real program binary to deploy (it splits into 3 buffer writes at the planner's 850-byte chunk size)
const MEMO_PROGRAM = kit.address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const vault = createVault('11111111-2222-3333-4444-555555555555');

let mocks: Mocks;
let run: typeof import('../src/run');
let programBinary: Uint8Array;
let bufferAddress: kit.Address;
let programAddress: kit.Address;

// Writes a keypair in the Solana CLI's JSON format (64 bytes: secret seed followed by public key)
function writeKeypairFile(filePath: string): kit.Address {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d!, 'base64url');
  const rawPublicKey = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url');
  fs.writeFileSync(filePath, JSON.stringify([...seed, ...rawPublicKey]));
  return kit.getAddressDecoder().decode(rawPublicKey);
}

before(async () => {
  const apiUserPublicKey = prepareWorkdir({
    FORDEFI_API_TOKEN: 'test-token',
    FORDEFI_VAULT_ID: vault.id,
    FORDEFI_VAULT_ADDRESS: vault.address,
  });

  const svm = new LiteSVM();
  fundAccount(svm, vault.address);

  const memo = svm.getAccount(MEMO_PROGRAM);
  assert.ok(memo.exists);
  programBinary = new Uint8Array(memo.data);
  fs.mkdirSync('target/deploy', { recursive: true });
  fs.writeFileSync('target/deploy/solana_deploy_contract_fordefi.so', programBinary);
  bufferAddress = writeKeypairFile('buffer-keypair.json');
  programAddress = writeKeypairFile('program-keypair.json');

  mocks = installMocks({ svm, vaults: [vault], apiUserPublicKey });
  // Loaded only now, because the config reads the env vars and API User key at import time
  run = require('../src/run');
});

after(() => mocks.restore());

test('deploys a program through Fordefi, co-signing with the local buffer and program keypairs', async () => {
  await run.main();

  // the planner packs the buffer setup, 850-byte writes and deploy into several transactions
  const expectedTransactions = mocks.fordefiRequests.length;
  assert.ok(expectedTransactions > 1, 'the deploy spans multiple transactions');
  for (const { body } of mocks.fordefiRequests) {
    assert.equal(body.type, 'solana_transaction');
    assert.equal(body.vault_id, vault.id);
    assert.equal(body.details.type, 'solana_serialized_transaction_message');
    assert.equal(body.details.push_mode, 'manual');
    assert.equal(body.details.chain, 'solana_devnet');
    assert.deepEqual(body.details.fee, { type: 'custom', unit_price: '5000' });
  }

  // Fordefi never broadcast: every transaction went through the example's own RPC
  assert.deepEqual(
    mocks.sentTransactions.map(t => t.host),
    Array(expectedTransactions).fill('api.devnet.solana.com'),
  );

  const program = mocks.svm.getAccount(programAddress);
  assert.ok(program.exists && program.executable, 'program account is deployed');
  assert.equal(program.exists && program.programAddress, LOADER_V3_PROGRAM_ADDRESS);
  assert.equal(mocks.svm.getAccount(bufferAddress).exists, false, 'buffer is consumed by the deploy');
});

test('the deployed program executes', async () => {
  // a program deployed in this slot only becomes invocable from the next one
  mocks.svm.warpToSlot(mocks.svm.getClock().slot + 1n);

  const payer = await kit.generateKeyPairSigner();
  fundAccount(mocks.svm, payer.address, 1n);
  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    msg => kit.setTransactionMessageFeePayerSigner(payer, msg),
    msg => kit.setTransactionMessageLifetimeUsingBlockhash({ blockhash: mocks.svm.latestBlockhash(), lastValidBlockHeight: 0n }, msg),
    msg => kit.appendTransactionMessageInstruction({ programAddress, data: new TextEncoder().encode('deployed with Fordefi') }, msg),
  );
  const result = mocks.svm.sendTransaction(await kit.signTransactionMessageWithSigners(message));

  assert.ok(!(result instanceof FailedTransactionMetadata), `memo call failed: ${result.toString()}`);
  assert.ok(result.logs().some(log => log.includes('deployed with Fordefi')));
});
