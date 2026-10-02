// Caches the deployed Subscriptions program binary in test/fixtures/ so the tests can execute the real
// program in LiteSVM. One read-only RPC call on the first run; the tests themselves stay offline.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SUBSCRIPTIONS_PROGRAM_ADDRESS } from '@solana/subscriptions';

export const PROGRAM_PATH = path.join(__dirname, 'fixtures', 'subscriptions.so');
const RPC_URL = 'https://api.mainnet-beta.solana.com';
// UpgradeableLoaderState::ProgramData header: 4-byte tag, 8-byte slot, 1 + 32 byte upgrade authority option
const PROGRAM_DATA_HEADER = 45;

async function getAccountData(address: string): Promise<{ data: Buffer }> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [address, { encoding: 'base64' }] }),
  });
  const { result, error } = (await response.json()) as any;
  if (error || !result?.value) {
    throw new Error(`getAccountInfo(${address}) failed: ${JSON.stringify(error ?? 'account not found')}`);
  }
  return { data: Buffer.from(result.value.data[0], 'base64') };
}

async function main(): Promise<void> {
  if (fs.existsSync(PROGRAM_PATH)) {
    return;
  }
  // The program account holds the address of its ProgramData account at bytes 4..36
  const { data: programAccount } = await getAccountData(SUBSCRIPTIONS_PROGRAM_ADDRESS);
  const { getAddressDecoder } = await import('@solana/kit');
  const programDataAddress = getAddressDecoder().decode(programAccount.subarray(4, 36));
  const { data: programData } = await getAccountData(programDataAddress);

  fs.mkdirSync(path.dirname(PROGRAM_PATH), { recursive: true });
  fs.writeFileSync(PROGRAM_PATH, programData.subarray(PROGRAM_DATA_HEADER));
  console.log(`Cached the Subscriptions program (${programData.length - PROGRAM_DATA_HEADER} bytes) at ${PROGRAM_PATH}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Failed to fetch the Subscriptions program: ${error.message}`);
    process.exit(1);
  });
}
