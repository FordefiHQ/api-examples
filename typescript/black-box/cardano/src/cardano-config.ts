import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export const CARDANO_NETWORK = process.env.CARDANO_NETWORK || 'mainnet'; // mainnet or preprod
export const BLOCKFROST_BASE_URL =
    CARDANO_NETWORK === 'mainnet'
        ? 'https://cardano-mainnet.blockfrost.io/api/v0'
        : 'https://cardano-preprod.blockfrost.io/api/v0';
export const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID!;
export const FORDEFI_API_PATH = '/api/v1/transactions';

export const fordefiConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN!,
    vaultId: process.env.BLACKBOX_VAULT_ID!,
    vaultPublicKey: process.env.VAULT_PUBLIC_KEY!,
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
};

export const transferConfig = {
    destinationAddress: process.env.DESTINATION_ADDRESS,
    amountLovelace: 1_500_000n, // 1.5 ADA — comfortably above the ~1 ADA min-UTxO floor
};

export const stakingConfig = {
    poolId: process.env.POOL_ID!, // bech32 pool id (pool1...) to delegate to
};

export const cardanoConfig = {
    // If Fordefi signing takes longer than this, the tx expires and must be rebuilt.
    ttlBufferSlots: 7200, // ~2 hours (1 slot = 1 second)
};
