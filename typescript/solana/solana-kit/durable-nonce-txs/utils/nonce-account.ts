import bs58 from 'bs58';
import { Rpc, SolanaRpcApi } from '@solana/kit';

export const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111';

export interface NonceAccount {
  /** The nonce authority. Only this signer can spend the nonce. */
  authority: string;
  /** The stored durable nonce. A transaction can use it as its lifetime instead of a recent blockhash. */
  durableNonce: string;
}

/**
 * Decodes the System program's nonce account layout (80 bytes):
 *   4-byte version (1) | 4-byte state tag (1 = initialized) | 32-byte authority
 *   | 32-byte durable nonce | 8-byte lamports-per-signature
 * RPC's parsed JSON labels the state differently on each cluster, so this reads the raw bytes.
 */
export function parseNonceAccountData(data: Uint8Array): NonceAccount {
  if (data.length !== 80) {
    throw new Error(`Expected an 80-byte nonce account, got ${data.length} bytes`);
  }
  const version = data[0];
  const state = data[4];
  if (version !== 1 || state !== 1) {
    throw new Error(`Not an initialized nonce account (version ${version}, state tag ${state})`);
  }
  return {
    authority: bs58.encode(data.slice(8, 40)),
    durableNonce: bs58.encode(data.slice(40, 72)),
  };
}

export async function fetchNonceAccount(rpc: Rpc<SolanaRpcApi>, address: string): Promise<NonceAccount> {
  const { value } = await rpc.getAccountInfo(address as any, { encoding: 'base64' }).send();
  if (!value) {
    throw new Error(`Nonce account ${address} not found on chain`);
  }
  if (value.owner !== SYSTEM_PROGRAM_ADDRESS) {
    throw new Error(`Account ${address} is owned by ${value.owner}, not the System program`);
  }
  return parseNonceAccountData(new Uint8Array(Buffer.from(value.data[0], 'base64')));
}
