import dotenv from 'dotenv'
import fs from 'fs'
import { Network } from "@aptos-labs/ts-sdk";

dotenv.config()

export const APTOS_NETWORK = Network.MAINNET

export interface FordefiAptosConfig {
    accessToken: string;
    fordefiVaultID: string;
    fordefiVaultAddress: string;
    externalWalletAddress: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
    amount: bigint;
    asset?: string;
    decimals?: bigint;
  };

export const fordefiConfig: FordefiAptosConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN || "",
    fordefiVaultID: process.env.BLACKBOX_VAULT_ID || "",
    fordefiVaultAddress: process.env.BLACK_BOX_VAULT_ADDRESS || "",
    externalWalletAddress: process.env.PETRA_ACCOUNT_ADDRESS || "",
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
    apiPathEndpoint: '/api/v1/transactions',
    amount: 100_000_000n // 1 APT = 100_000_000n
    // asset: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', // Mainnet USDC
    // decimals: 6n, // depends on the asset, check on a block explorer >> https://aptoscan.com/,
};