import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

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
    originVault: process.env.FORDEFI_VAULT_ID || "",
    originAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
    destAddress: process.env.DESTINATION_ADDRESS || "",
    feePayer: process.env.FEE_PAYER_VAULT_ADDRESS || "",
    feePayerVault: process.env.FEE_PAYER_VAULT_ID || "",
    privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
    apiPathEndpoint: '/api/v1/transactions',
    rpcUrl: 'https://api.devnet.solana.com', // or https://api.mainnet.solana.com
    chain: 'solana_devnet', // must match rpcUrl above: solana_mainnet or solana_devnet
    tokenMint: '4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7', // Devnet USDG (Token-2022)
    decimals: 6n,
    amount: 1_000n, // 1 USDG = 1_000_000n
};
