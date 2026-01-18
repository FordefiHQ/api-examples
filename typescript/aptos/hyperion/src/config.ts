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
    apiPathEndpoint: string
  };
  
export const fordefiConfig: FordefiAptosConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN!,
    originVaultId: "1dcb5a50-1d77-4869-876e-c18c73152cf5", // your Fordefi Aptos Vault Id
    originAddress: "0x125cdce37fe906619ffe12c4d411041f4de297c4b7667042a6fe3f3e1c9edcc6", // your Fordefi Aptos Vault address
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'), // your Fordefi API User private key
    apiPathEndpoint: '/api/v1/transactions'
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

export const POSITION_ID = process.env.POSITION_ID!;
export const removeRatio = 1.0;  // 1 == Remove 100% of liquidity
    