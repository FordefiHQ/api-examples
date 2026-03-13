import { FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config();

// PLACEHOLDERS TO CONFIGURE
export const CONTRACT_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
export const DESTINATION_ADDRESS = "0xF659feEE62120Ce669A5C45Eb6616319D552dD93"; 
export const DECIMALS = 6;

export const fordefiConfig: FordefiProviderConfig = {
    chainId: 1,
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will call the contract
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./fordefi-response/fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://eth.llamarpc.com', // fallback RPC
    skipPrediction: true
};