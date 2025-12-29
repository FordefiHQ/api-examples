import { FordefiNearConfig } from './interfaces';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export const NEAR_NETWORK = process.env.NEAR_NETWORK || 'mainnet'; // mainnet or testnet
export const NEAR_RPC_URL = process.env.NEAR_RPC_URL || (NEAR_NETWORK === 'mainnet'
    ? 'https://rpc.mainnet.near.org'
    : 'https://rpc.testnet.near.org');

export const fordefiNearConfig: FordefiNearConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN || "",
    originVault: process.env.BLACKBOX_VAULT_ID || "",
    originAddress: process.env.NEAR_ADDRESS || "", // 64-char hex implicit account or named account
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
    apiPathEndpoint: '/api/v1/transactions',
    transferAmount: 0.001, // Amount in NEAR to transfer
    stakeAmount: 0.001, // Amount in NEAR to stake
    stakingPoolId: process.env.STAKING_POOL_ID || "", // e.g., "figment.poolv1.near"
};
