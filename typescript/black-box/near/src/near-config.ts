import { FordefiNearConfig, IntentsEnvConfig } from './interfaces';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export const NEAR_NETWORK = process.env.NEAR_NETWORK || 'mainnet'; // mainnet or testnet
export const NEAR_RPC_URL = process.env.NEAR_RPC_URL || (NEAR_NETWORK === 'mainnet'
    ? 'https://rpc.mainnet.near.org'
    : 'https://rpc.testnet.near.org');

export const WNEAR_CONTRACT = NEAR_NETWORK === 'mainnet' ? 'wrap.near' : 'wrap.testnet';

// Build intents config only if the required env var is present
function loadIntentsConfig(): IntentsEnvConfig | undefined {
    const originAsset = process.env.INTENTS_ORIGIN_ASSET;
    if (!originAsset) return undefined;

    return {
        originAsset,
        destinationAsset: process.env.INTENTS_DESTINATION_ASSET || "",
        amount: process.env.INTENTS_AMOUNT || "",
        recipient: process.env.INTENTS_RECIPIENT || "",
        slippage: parseInt(process.env.INTENTS_SLIPPAGE || "100", 10),
        apiKey: process.env.ONECLICK_API_KEY || undefined,
    };
}

export const fordefiNearConfig: FordefiNearConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN || "",
    originVault: process.env.BLACKBOX_VAULT_ID || "",
    originAddress: process.env.NEAR_ADDRESS || "", // 64-char hex implicit account or named account
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
    apiPathEndpoint: '/api/v1/transactions',
    transferAmount: 0.001, // Amount in NEAR to transfer
    stakeAmount: 0.001, // Amount in NEAR to stake
    stakingPoolId: process.env.STAKING_POOL_ID || "", // e.g., "figment.poolv1.near"
    intents: loadIntentsConfig(),
};
