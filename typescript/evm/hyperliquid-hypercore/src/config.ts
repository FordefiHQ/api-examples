import fs from 'fs';
import dotenv from 'dotenv';
import { FordefiProviderConfig } from '@fordefi/web3-provider';

dotenv.config()

export interface HyperliquidConfig { 
    action: "deposit" | "withdraw" | "sendUsd"
    isTestnet: boolean,
    destination?: `0x${string}`,
    amount?: string,
    agentPk?: string
};

// Configure the Fordefi provider
export const fordefiConfig: FordefiProviderConfig = {
    chainId: 42161, // Arbitrum -> 42161
    address: '0x5b7a034488f0bde8bad66f49cf9587ad40b6c757', // The Fordefi EVM Vault that will sign the message
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://1rpc.io/arb',
    skipPrediction: true 
};

export const hyperliquidConfig: HyperliquidConfig = {
    action: "sendUsd",
    isTestnet: false,
    destination: fordefiConfig.address, // Change to your destination address
    amount: "1",
    agentPk: process.env.HYPERCORE_TESTNET_AGENT_PK ?? (() => { throw new Error('API Agent private key is not set'); })(),
};