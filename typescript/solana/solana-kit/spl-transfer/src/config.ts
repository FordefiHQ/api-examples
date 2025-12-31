import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export interface FordefiSolanaConfig {
  accessToken: string;
  originVault: string;
  originAddress: string;
  destAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
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
  originVault: process.env.ORIGIN_VAULT || "",
  originAddress: process.env.ORIGIN_ADDRESS || "",
  destAddress: process.env.DESTINATION_ADDRES || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions',
  mainnetRpc: 'https://api.mainnet-beta.solana.com',
  ws: 'ws://api.mainnet-beta.solana.com'
};

export const transferConfig: TransferConfig = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  decimals: 6,                                            
  amount: 100, // 1 USDC = 1_000_000
  useJito: false,
  // jitoTip: 1000  // only required if useJito: true
};