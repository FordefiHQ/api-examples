import { FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config();

export const PATH = '/api/v1/transactions/create-and-wait';
export const PK_PATH = './fordefi_secret/private.pem';
export const FORDEFI_EVM_VAULT_ID = process.env.FORDEFI_EVM_VAULT_ID ?? (() => { throw new Error('FORDEFI_EVM_VAULT_ID is not set'); })()

export const transferConfig = {
    amountToTransfer: '10000', // Amount in smallest unit (e.g., '10000' for 0.01 INIT)
    destination: 'init1akp3t73wcnwsm2v8p0uv64lt7ft2jpmjk9e02c',
    gasLimit: 500000,  // Gas limit for the transaction
    gasPrice: '10000' // Gas price in smallest INIT unit
};

export const fordefiConfig: FordefiProviderConfig = {
    chainId: 1, // Ethereum mainnet but not very important as we'll only be signing messages
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://eth.llamarpc.com',
    skipPrediction: false
};