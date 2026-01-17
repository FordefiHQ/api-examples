import { HyperionSDK } from '@hyperionxyz/sdk';
import { Network } from "@aptos-labs/ts-sdk";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export interface FordefiAptosConfig {
    accessToken: string;
    originVaultId: string;
    originAddress: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
    asset: string;
    decimals: bigint;
    amount: bigint
  };
  
export const fordefiConfig: FordefiAptosConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN!,
    originVaultId: "1dcb5a50-1d77-4869-876e-c18c73152cf5", // your Fordefi Aptos Vault Id
    originAddress: "0x125cdce37fe906619ffe12c4d411041f4de297c4b7667042a6fe3f3e1c9edcc6", // your Fordefi Aptos Vault address
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'), // your Fordef User private key
    apiPathEndpoint: '/api/v1/transactions',
    asset: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', // Mainnet USDC
    decimals: 6n, // depends on the asset, check on a block explorer >> https://aptoscan.com/
    amount: 1n,
};

export const APTOS_NETWORK = Network.MAINNET

export const sdk = new HyperionSDK({
    network: APTOS_NETWORK,
    contractAddress: "0x8b4a2c4bb53857c718a04c020b98f8c2e1f99a68b0f57389a8bf5434cd22e05c",
    hyperionFullNodeIndexerURL: "https://api.hyperion.xyz/v1/graphql",
    hyperionAPIHost: "https://api.hyperion.xyz",
    officialFullNodeIndexerURL: "https://api.mainnet.aptoslabs.com/v1/graphql",
    APTOS_API_KEY: process.env.GEOMI_API_KEY!
  }
);

export const POSITION_ID = "0x5048353d9f875957afe5a5117483e819b971ffd00e03f172e8d744b48248f46e";
export const removeRatio = 1.0;  // 1 == Remove 100% of liquidity
    