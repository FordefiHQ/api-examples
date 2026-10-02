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
  delegatorVault: string;
  delegatorAddress: string;
  delegateeVault: string;
  delegateeAddress: string;
  privateKeyPem: string;
  chain: 'solana_mainnet' | 'solana_devnet';
  mainnetRpc: string;
  ws: string
}

export interface DelegationConfig {
  mint: string;
  decimals: number;
  nonce: number;           // differentiates multiple delegations to the same delegatee
  allowance: number;       // total amount the delegatee can pull, in base units
  expiryDays: number;      // delegation expiry from now, 0 = no expiry
  transferAmount: number;  // amount pulled per transfer, in base units
  receiverAddress?: string // defaults to the delegatee's own wallet
}

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  delegatorVault: process.env.DELEGATOR_VAULT_ID || "",
  delegatorAddress: process.env.DELEGATOR_VAULT_ADDRESS || "",
  delegateeVault: process.env.DELEGATEE_VAULT_ID || "", // only required for the transfer script
  delegateeAddress: process.env.DELEGATEE_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
  chain: 'solana_mainnet', // must match mainnetRpc/ws below: solana_mainnet or solana_devnet
  mainnetRpc: 'https://api.mainnet-beta.solana.com',
  ws: 'wss://api.mainnet-beta.solana.com'
};

export const delegationConfig: DelegationConfig = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  decimals: 6,
  nonce: 0,
  allowance: 1_000_000,   // 1 USDC
  expiryDays: 30,
  transferAmount: 100_000 // 0.1 USDC
};
