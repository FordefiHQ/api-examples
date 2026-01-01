import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export interface FordefiSolanaConfig {
  accessToken: string;
  deployerVaultId: string;
  deployerVaultAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
  rpc: string;
  ws: string;
  bufferKeypairPath: string;
  programKeypairPath: string;
  programBinaryPath: string;
  // Custom fee in lamports to prevent Fordefi from using its own fee estimation.
  // Fordefi's default estimation can charge ~0.07 SOL per transaction, which
  // with 212+ write transactions (that's for a small Anchor program) would result in 15+ SOL in fees alone!
  defaultFeeLamports: string;
}

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  deployerVaultId: process.env.FORDEFI_VAULT_ID || "",
  deployerVaultAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions',
  rpc: 'https://api.devnet.solana.com',
  ws: 'wss://api.devnet.solana.com',
  bufferKeypairPath: './buffer-keypair.json',
  programKeypairPath: './program-keypair.json',
  programBinaryPath: './target/deploy/solana_deploy_contract_fordefi.so',
  defaultFeeLamports: '5000',
};