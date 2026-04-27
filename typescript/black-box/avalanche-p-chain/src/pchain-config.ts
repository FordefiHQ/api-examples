import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export const AVALANCHE_NETWORK = process.env.AVALANCHE_NETWORK || 'mainnet';
export const PCHAIN_RPC_URL = process.env.PCHAIN_RPC_URL || 'https://api.avax.network';
export const FORDEFI_API_PATH = '/api/v1/transactions';

export const fordefiConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN || '',
    vaultId: process.env.BLACKBOX_VAULT_ID || '',
    vaultPublicKey: process.env.VAULT_PUBLIC_KEY || '',
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
};

export const transferConfig = {
    destinationAddress: process.env.DESTINATION_ADDRESS || '',
    amountAvax: 0.001,
};

// Avalanche enforces a 25 AVAX minimum delegation and a 14-day minimum duration.
export const stakingConfig = {
    nodeId: process.env.NODE_ID || '',
    rewardAddress: process.env.REWARD_ADDRESS,
    stakeAmount: 25_000_000_000n,
    startTime: BigInt(Math.floor(Date.now() / 1000) + 60),
    endTime: BigInt(Math.floor(Date.now() / 1000) + 60 + 14 * 24 * 60 * 60),
};
