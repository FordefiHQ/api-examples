import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

export interface FordefiSolanaConfig {
  accessToken: string;
  vaultId: string;
  fordefiSolanaVaultAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
};

export interface FragmetricConfig {
  restakeAmount: bigint,
  assetMint: string | null
};

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.SOLANA_VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.SOLANA_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

export const fragmetricConfig: FragmetricConfig = {
  restakeAmount: 100n, // in lamports
  assetMint: null      // null means we're restaking SOL for fragSOL
};

export const solanaCluster = 'https://api.mainnet-beta.solana.com';