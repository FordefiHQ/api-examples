import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// All solana-kit examples share one .env and one API User key at the solana-kit root.
// A .env in this project, if present, takes precedence over the shared one.
const SOLANA_KIT_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: ['.env', path.join(SOLANA_KIT_ROOT, '.env')] });
const PRIVATE_KEY_PATH = process.env.FORDEFI_PRIVATE_KEY_PATH || path.join(SOLANA_KIT_ROOT, 'secret', 'private.pem');

export interface FordefiSolanaConfig {
  accessToken: string;
  vaultId: string;
  fordefiSolanaVaultAddress: string;
  privateKeyPem: string;
  chain: 'solana_mainnet' | 'solana_devnet';
};

export interface FragmetricConfig {
  restakeAmount: bigint,
  assetMint: string | null
};

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.FORDEFI_VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
  chain: 'solana_mainnet'
};

export const fragmetricConfig: FragmetricConfig = {
  restakeAmount: 100n, // in lamports
  assetMint: null      // null means we're restaking SOL for fragSOL
};

export const solanaCluster = 'https://api.mainnet-beta.solana.com';