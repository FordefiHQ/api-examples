import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export interface FordefiSolanaConfig {
  accessToken: string;
  delegatorVault: string;
  delegatorAddress: string;
  delegateeVault: string;
  delegateeAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
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
  delegatorVault: process.env.DELEGATOR_VAULT || "",
  delegatorAddress: process.env.DELEGATOR_ADDRESS || "",
  delegateeVault: process.env.DELEGATEE_VAULT || "", // only required for the transfer script
  delegateeAddress: process.env.DELEGATEE_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions',
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
