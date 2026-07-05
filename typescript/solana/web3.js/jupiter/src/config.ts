import fs from 'fs';
import dotenv from 'dotenv';
import { FordefiConfig, SwapConfig } from './interfaces';

dotenv.config()

export const fordefiConfig: FordefiConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions'
};

export const swapConfig: SwapConfig = {
  swapAmount: '100', // in lamports (1 SOL = 1e9 lamports)
  slippage: '50', // in bps
  inputToken: 'So11111111111111111111111111111111111111112', // SOL
  outputToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC Mint Address
  jupiterApiKey: process.env.JUPITER_API_KEY || ""
};