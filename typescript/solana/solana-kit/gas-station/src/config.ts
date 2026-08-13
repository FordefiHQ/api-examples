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
    rpcUrl: string;
    chain: string;
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
    rpcUrl: 'https://api.devnet.solana.com', // or https://api.mainnet.solana.com
    chain: 'solana_devnet', // must match rpcUrl above: solana_mainnet or solana_devnet
    tokenMint: '4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7', // Devnet USDG (Token-2022)
    decimals: 6n,
    amount: 1_000n, // 1 USDG = 1_000_000n
};
