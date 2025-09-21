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
    originVaultId: "1dcb5a50-1d77-4869-876e-c18c73152cf5", // your Fordefi Aptos Vault Id
    originAddress: "0x125cdce37fe906619ffe12c4d411041f4de297c4b7667042a6fe3f3e1c9edcc6", // your Fordefi Aptos Vault address
    destAddress: "0x8d5c07055c3b58f979998b7f7e754b9febff64858e03adba77d097be97622b47",
    sponsor: "0x6ad7edfe6c3444d245e72616a9a403205b08d47f6db92aace8dba88556ffccad", // your Geomi gas station address
    sponsor_api_key: process.env.GAS_STATION_API_KEY!, // your Geomi gas station API Key
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'), // your Fordef User private key
    apiPathEndpoint: '/api/v1/transactions',
    asset: '0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832', // Testnet USDC
    decimals: 6n, // depends on the asset, check on a block explorer >> https://aptoscan.com/
    amount: 1n,
};

export const APTOS_NETWORK = Network.TESTNET