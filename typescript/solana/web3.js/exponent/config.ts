import { Connection } from '@solana/web3.js'
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

export interface ExponentConfig {
  market: string;
  investAmount: bigint;
  action: "buy" | "sell"
};

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.SOLANA_VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.SOLANA_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

export const exponentConfig: ExponentConfig = {
  market: "EJ4GPTCnNtemBVrT7QKhRfSKfM53aV2UJYGAC8gdVz5b", // fragSOL market, you can find more markets at https://web-api.exponent.finance/api/markets
  investAmount: 100n, // in smallest fragSOL units (9 decimals -> https://solscan.io/token/FRAGSEthVFL7fdqM8hxfxkfCZzUvmg21cqPJVvC1qdbo)
  action: "sell", // buy -> to aquire PT tokens / sell -> to aquire fragSOL
};

export const connection = new Connection('https://api.mainnet-beta.solana.com');