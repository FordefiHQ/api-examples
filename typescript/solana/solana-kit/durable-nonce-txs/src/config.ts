import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// All solana-kit examples share one .env and one API User key at the solana-kit root.
// A .env in this project overrides the shared one.
const SOLANA_KIT_ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: ['.env', path.join(SOLANA_KIT_ROOT, '.env')] });
const PRIVATE_KEY_PATH = process.env.FORDEFI_PRIVATE_KEY_PATH || path.join(SOLANA_KIT_ROOT, 'secret', 'private.pem');

export type SolanaChain = 'solana_mainnet' | 'solana_devnet';

export interface FordefiSolanaConfig {
  accessToken: string;
  vaultId: string;
  vaultAddress: string;
  privateKeyPem: string;
  apiBaseUrl: string;
  chain: SolanaChain;
  rpcUrl: string;
}

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.FORDEFI_VAULT_ID || "",
  vaultAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
  apiBaseUrl: process.env.FORDEFI_API_BASE_URL || 'https://api.fordefi.com',
  chain: 'solana_mainnet', // Must match rpcUrl. For solana_devnet, use https://api.devnet.solana.com
  rpcUrl: 'https://api.mainnet-beta.solana.com',
};

export const nonceConfig = {
  // Number of nonce accounts to create per run (1-4).
  count: 1,
};

export const transferConfig = {
  destinationAddress: process.env.DESTINATION_ADDRESS || "",
  amountLamports: 1_000_000n, // 0.001 SOL. A new recipient account needs at least the rent-exempt minimum (about 0.0009 SOL).
};
