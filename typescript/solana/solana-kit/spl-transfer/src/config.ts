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
  originVault: string;
  originAddress: string;
  destAddress: string;
  privateKeyPem: string;
  chain: 'solana_mainnet' | 'solana_devnet';
  mainnetRpc: string;
  ws: string
}

export interface TransferConfig {
  mint: string;
  decimals: number;
  amount: number;
  useJito: boolean;
  jitoTip?: number
}

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  originVault: process.env.FORDEFI_VAULT_ID || "",
  originAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
  destAddress: process.env.DESTINATION_ADDRESS || "",
  privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
  chain: 'solana_mainnet',
  mainnetRpc: 'https://api.mainnet-beta.solana.com',
  ws: 'wss://api.mainnet-beta.solana.com'
};

export const transferConfig: TransferConfig = {
  mint: '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH', // USDG (Token-2022); classic SPL mints such as USDC work too
  decimals: 6,
  amount: 10_000, // 0.01 USDG (1 USDG = 1_000_000)
  useJito: false,
  // jitoTip: 1000  // only required if useJito: true
};