import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

export interface FordefiSolanaConfig {
    accessToken: string;
    originVault: string;
    originAddress: string;
    destAddress: string;
    feePayer: string;
    feePayerVault: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
    tokenMint: string;
    decimals: bigint;
    amount: bigint;
    durableNonceAccount?: string
  };
  
export const fordefiConfig: FordefiSolanaConfig = {
    accessToken: process.env.FORDEFI_API_TOKEN || "",
    originVault: process.env.ORIGIN_VAULT || "",
    originAddress: process.env.ORIGIN_ADDRESS || "",
    destAddress: process.env.DESTINATION_ADDRES || "",
    feePayer: process.env.FEE_PAYER_ADDRESS || "",
    feePayerVault: process.env.FEE_PAYER_VAULT || "",
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
    apiPathEndpoint: '/api/v1/transactions',
    tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
    decimals: 6n,
    amount: 1_000n, // 1 USCD = 1_000_000n
};