import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as kit from '@solana/kit';
import { LiteSVM } from 'litesvm';
import { Mocks, createVault, fundAccount, installMocks, prepareWorkdir } from './harness';

const SYSTEM_PROGRAM = kit.address('11111111111111111111111111111111');
const LAMPORTS = 1_000_000n;
const vault = createVault('11111111-2222-3333-4444-555555555555');
const destination = createVault('unused').address;

let mocks: Mocks;
let run: typeof import('../run');

// Stands in for the Fragmetric deposit, which needs live mainnet state to build. Like the SDK, it
// marks the vault as a signer with its own no-op signer, which the example must swap for Fordefi's.
async function buildInstructions(): Promise<kit.Instruction[]> {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); // SystemInstruction::Transfer
  view.setBigUint64(4, LAMPORTS, true);
  const vaultMeta: kit.AccountSignerMeta = {
    address: vault.address,
    role: kit.AccountRole.WRITABLE_SIGNER,
    signer: kit.createNoopSigner(vault.address),
  };
  return [
    {
      programAddress: SYSTEM_PROGRAM,
      accounts: [vaultMeta, { address: destination, role: kit.AccountRole.WRITABLE }],
      data,
    },
  ];
}

before(() => {
  const apiUserPublicKey = prepareWorkdir({
    FORDEFI_API_TOKEN: 'test-token',
    FORDEFI_VAULT_ID: vault.id,
    FORDEFI_VAULT_ADDRESS: vault.address,
  });

  const svm = new LiteSVM();
  fundAccount(svm, vault.address);

  mocks = installMocks({ svm, vaults: [vault], apiUserPublicKey });
  // Loaded only now, because the config reads the env vars and API User key at import time
  run = require('../run');
});

after(() => mocks.restore());

test('auto push mode: Fordefi signs and broadcasts the restaking transaction', async () => {
  await run.main(buildInstructions);

  assert.equal(mocks.fordefiRequests.length, 1);
  const [request] = mocks.fordefiRequests;
  assert.equal(request?.body.type, 'solana_transaction');
  assert.equal(request?.body.vault_id, vault.id);
  assert.equal(request?.body.details.type, 'solana_serialized_transaction_message');
  assert.equal(request?.body.details.push_mode, 'auto');
  assert.equal(request?.body.details.chain, 'solana_mainnet');
  assert.ok(request?.idempotenceId, 'native requests carry an x-idempotence-id');

  // LiteSVM verifies signatures, so the transaction only lands with a valid vault signature
  assert.deepEqual(mocks.sentTransactions.map(t => t.host), ['api.fordefi.com']);
  assert.equal(mocks.svm.getBalance(destination), LAMPORTS);
});
