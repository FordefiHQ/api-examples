import fs from 'fs';
import dotenv from 'dotenv';
import { address, type Address } from '@solana/kit';

dotenv.config();

export const RPC_URL = "https://api.devnet.solana.com";
export const WSS_URL = "wss://api.devnet.solana.com";

export const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const USDG_MINT = address("4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7");

export interface SameTokenTransfer {
  recipient: Address;
  amount: bigint;
}

export const SAME_TOKEN_TRANSFERS: SameTokenTransfer[] = [
  { recipient: address("DrUP6kWeYH43cUKy3q9nCNGMjicp5PaieUvVi3ebcngP"), amount: BigInt(1_000_000) },
  { recipient: address("9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS"), amount: BigInt(1_000_000) },
  { recipient: address("HK3K2SM1vq3debTSZ1creeXpkj29VyUKC4P4BdHDL65k"), amount: BigInt(1_000_000) },
];

export interface MultiTokenTransfer {
  mint: Address;
  recipient: Address;
  amount: bigint;
}

// Multi-token transfers: each entry can use a different mint
export const MULTI_TOKEN_TRANSFERS: MultiTokenTransfer[] = [
  { mint: USDC_MINT, recipient: address("DrUP6kWeYH43cUKy3q9nCNGMjicp5PaieUvVi3ebcngP"), amount: BigInt(1_000_000) },
  { mint: USDG_MINT, recipient: address("9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS"), amount: BigInt(1_000_000) },
];

export interface FordefiSolanaConfig {
  accessToken: string;
  originVault: string;
  originAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
  rpcUrl: string;
  wsUrl: string;
  chain: string;
  push_to_custom_url: boolean,
  single_token_batch_mint: Address
}

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  originVault: process.env.ORIGIN_VAULT || "",
  originAddress: process.env.ORIGIN_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions',
  rpcUrl: RPC_URL,
  wsUrl: WSS_URL,
  chain: "solana_devnet",
  push_to_custom_url: false,
  single_token_batch_mint: USDC_MINT
};
