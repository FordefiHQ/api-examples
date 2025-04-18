import { EvmChainId, FordefiProviderConfig } from '@fordefi/web3-provider';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config()

export interface HyperliquidConfig { // Customize this interface as needed
    destination?: `0x${string}`;
    amount?: string
};

// Configure the Fordefi provider
export const fordefiConfig: FordefiProviderConfig = {
    chainId: EvmChainId.NUMBER_42161, // Arbitrum
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    // skipPrediction: false 
};

export const hyperliquidConfig: HyperliquidConfig = {
    destination: fordefiConfig.address, // Change to your destination address
    amount: "5"
};