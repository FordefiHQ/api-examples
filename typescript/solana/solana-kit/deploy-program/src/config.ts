import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// All solana-kit examples share one .env and one API User key at the solana-kit root.
// A .env in this project, if present, takes precedence over the shared one.
const SOLANA_KIT_ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: ['.env', path.join(SOLANA_KIT_ROOT, '.env')] });
const PRIVATE_KEY_PATH = process.env.FORDEFI_PRIVATE_KEY_PATH || path.join(SOLANA_KIT_ROOT, 'secret', 'private.pem');

export interface FordefiSolanaConfig {
  accessToken: string;
  deployerVaultId: string;
  deployerVaultAddress: string;
  privateKeyPem: string;
  chain: 'solana_mainnet' | 'solana_devnet'; // must match the rpc below
  rpc: string;
  ws: string;
  bufferKeypairPath: string;
  programKeypairPath: string;
  programBinaryPath: string;
  defaultFeeLamports: string; // Custom fee in lamports to prevent Fordefi from using its own fee estimation.
  
}

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  deployerVaultId: process.env.FORDEFI_VAULT_ID || "",
  deployerVaultAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
  chain: 'solana_devnet',
  rpc: 'https://api.devnet.solana.com',
  ws: 'wss://api.devnet.solana.com',
  bufferKeypairPath: './buffer-keypair.json',
  programKeypairPath: './program-keypair.json',
  programBinaryPath: './target/deploy/solana_deploy_contract_fordefi.so',
  defaultFeeLamports: '5000',
};