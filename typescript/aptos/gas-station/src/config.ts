import { Network } from "@aptos-labs/ts-sdk";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export interface FordefiAptosConfig {
    accessToken: string;
    originVaultId: string;
    originAddress: string;
    destAddress: string;
    sponsor: string;
    sponsor_api_key: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
    asset: string;
    decimals: bigint;
    amount: bigint
  };
  
export const fordefiConfig: FordefiAptosConfig = {
    accessToken: process.env.API_USER_ACCESS_TOKEN!,
    originVaultId: "aae4a1e3-2550-43fd-a8c7-7506e0a2fef8", // your Fordefi Aptos Vault Id
    originAddress: "0xf021dd0c8a86abb3c7d3184c076afd1c7fb6512e303190de2b7fd588e1fe2aeb", // your Fordefi Aptos Vault address
    destAddress: "0x365eb26979fa83ee9fc8675fbbc2217981f3e64a138c6b3a9cc65ebf49c1cb28",
    sponsor: "0x6ad7edfe6c3444d245e72616a9a403205b08d47f6db92aace8dba88556ffccad", // your Geomi gas station address
    sponsor_api_key: process.env.GAS_STATION_API_KEY!, // your Geomi gas station API Key
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'), // your Fordef User private key
    apiPathEndpoint: '/api/v1/transactions',
    asset: '0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832', // Testnet USDC
    decimals: 6n, // depends on the asset, check on a block explorer >> https://aptoscan.com/
    amount: 1n,
};

export const APTOS_NETWORK = Network.TESTNET