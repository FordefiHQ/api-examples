import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export const POLKADOT_NETWORK = (process.env.POLKADOT_NETWORK || 'polkadot') as 'polkadot' | 'westend';

// Post-AHM (Nov 2025): DOT balances live on Asset Hub, not the relay chain.
export const NETWORKS = {
    polkadot: {
        rpcUrl: 'wss://polkadot-asset-hub-rpc.polkadot.io',
        ss58Prefix: 0,
        decimals: 10,
        symbol: 'DOT',
        subscanHost: 'assethub-polkadot.subscan.io',
    },
    westend: {
        rpcUrl: 'wss://westend-asset-hub-rpc.polkadot.io',
        ss58Prefix: 42,
        decimals: 12,
        symbol: 'WND',
        subscanHost: 'assethub-westend.subscan.io',
    },
} as const;
export const network = NETWORKS[POLKADOT_NETWORK];
export const RPC_URL = process.env.POLKADOT_RPC_URL || network.rpcUrl;
export const FORDEFI_API_PATH = '/api/v1/transactions';

export const fordefiConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN!,
    vaultId: process.env.BLACKBOX_VAULT_ID!,
    vaultPublicKey: process.env.VAULT_PUBLIC_KEY!,
    privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
};

export const transferConfig = {
    destinationAddress: process.env.DESTINATION_ADDRESS!,
    amountPlanck: 200_000_000n, // 0.02 DOT — 2x the 0.01 DOT Asset Hub existential deposit
};

export const polkadotConfig = {
    // Mortality window ≈ 6.4 min at 6s blocks; if Fordefi signing takes longer, rerun.
    eraPeriodBlocks: 64,
};
