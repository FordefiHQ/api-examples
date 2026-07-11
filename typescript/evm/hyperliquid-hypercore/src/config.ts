import dotenv from 'dotenv';
import type { OrderParameters } from "@nktkas/hyperliquid";
import type { AgentWalletConfig, EvmAddress, FordefiApiConfig, HyperliquidConfig } from './interfaces';
import { parseAction, validateAddress } from './validation';

dotenv.config()

/**
 * Fordefi API Configuration
 *
 * chainId determines the signing scheme used for Hyperliquid L1 actions.
 *
 * chainId: 1337 - Used for all Hyperliquid L1 actions
 *   - vault_transfer
 *   - approve_agent
 *   - revoke_agent
 *   - withdraw
 *   - sendUsd
 *   - spotTransfer
 *   - subAccountTransfer
 *   - placeOrder
 *
 * Deposit overrides this internally with Arbitrum chainId 42161 for its permit,
 * then submits an arbitrum_mainnet transaction. Do not edit this value for deposit.
 *
 * pushMode affects Hyperliquid L1 actions only. Deposit always broadcasts.
 */
export const fordefiConfig: FordefiApiConfig = {
    chainId: 1337,
    address: validateAddress(process.env.FORDEFI_EVM_VAULT_ADDRESS, 'FORDEFI_EVM_VAULT_ADDRESS'),
    vaultId: process.env.FORDEFI_EVM_VAULT_ID ?? (() => { throw new Error('FORDEFI_EVM_VAULT_ID is not set'); })(),
    accessToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(),
    privateKeyPath: './secret/private.pem',
    pathEndpoint: '/api/v1/transactions/create-and-wait',
    rpcUrl: 'https://1rpc.io/arb',
    pushMode: 'auto', // set to 'manual' if you just want the signed tx
};

/**
 * Agent Wallet Configuration (Optional)
 *
 * Agent wallets are NOT required for this Fordefi integration.
 * Since Fordefi supports signing with chainId 1337, all Hyperliquid actions
 * can be performed directly with your Fordefi vault.
 *
 * This config is only needed if you want to use Agent Wallets for custom use cases.
 */
export const agentWalletConfig: AgentWalletConfig = {
    agentName: "agent_smith",
    privateKeyOutputPath: './secret/agent-private-key-agent_smith.json',
    // validUntil: "1774777045175"
};

export const hyperliquidConfig: HyperliquidConfig = {
    action: parseAction(process.env.ACTION),
    isTestnet: false,
    destination: process.env.DESTINATION_ADDRESS as EvmAddress | undefined,
    amount: process.env.AMOUNT ?? "5",
    token: "USDC:0x6d1e7cde53ba9467b783cb7c530ce054",
    toSpot: true,
    isDeposit: true,
    // "subAccountTransfer" action — moves funds between the master account and one of its
    // sub-accounts. The router picks the right SDK call from `from`/`to`:
    //   master → sub or sub → master. Exactly one side must be "master".
    // NOTE: `market` selects which balance is moved (perps USDC vs spot token) — both ends use
    // the same market. This does NOT convert between balances (e.g. master spot → master perps);
    // for that, use the "spotTransfer" action instead.
    transfer: {
        market: "perps",                    // "spot" (subAccountSpotTransfer) | "perps" (subAccountTransfer)
        from: "master",                     // "master" or "0x<subaccount>"
        to: process.env.SUBACCOUNT_ADDRESS as `0x${string}`, // "master" or "0x<subaccount>"
        amount: "1",
        //token: "USDC:0x.....", // required when market: "spot"
    },
    hyperliquidVaultAddress: "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303",
    usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    bridgeAddress: "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7",
};

export const orderConfig: OrderParameters = {
    orders: [{
        a: 0, // Asset index (BTC)
        b: true, // Buy side
        p: "", // Price, will be updated to the mid
        s: "0.01", // Size
        r: false, // Reduce only
        t: { limit: { tif: "Gtc" } },
    }],
};
