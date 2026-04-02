import dotenv from 'dotenv';
import { OrderParameters } from "@nktkas/hyperliquid";

dotenv.config()

export interface FordefiApiConfig {
    vaultId: string;
    address: string;
    accessToken: string;
    privateKeyPath: string;
    pathEndpoint: string;
    rpcUrl: string;
    chainId: number;
    pushMode: "auto" | "manual";
}

export interface HyperliquidConfig {
    action: "deposit" | "withdraw" | "sendUsd" | "vault_transfer" | "approve_agent" | "revoke_agent" | "spotTransfer" | "placeOrder"
    isTestnet: boolean,
    destination?: `0x${string}`,
    amount?: string,
    token?: string,               // Required for "spotTransfer" action (format: "TOKEN:address")
    isDeposit?: boolean,          // Required for "vault_transfer" action
    hyperliquid_vault_address?: string
    toSpot?: boolean              // Required for "spotTransfer": true = Perps→Spot, false = Spot→Perps
    usdcAddress?: string,         // Arbitrum USDC contract address (deposit action)
    bridgeAddress?: string,       // Hyperliquid bridge contract address (deposit action)
}

export interface AgentWalletConfig {
    agentAddress: string,
    agentName: string,
    validUntil?: string // only required for a "approve_agent" action, MAX is 180 days in UNIX time
}

/**
 * Fordefi API Configuration
 *
 * IMPORTANT: chainId determines the signing scheme used.
 *
 * chainId: 1337 - Works for ALL actions EXCEPT deposit
 *   - vault_transfer
 *   - approve_agent
 *   - revoke_agent
 *   - withdraw
 *   - sendUsd
 *   - spotTransfer
 *   - placeOrder
 *
 * chainId: 42161 - REQUIRED for deposit (Arbitrum on-chain transaction)
 *   - deposit (USDC from Arbitrum to Hyperliquid)
 *
 * pushMode: "auto" broadcasts transactions automatically after MPC signature.
 *           "manual" returns the signed transaction without broadcasting,
 *           allowing you to poll and extract the raw signature.
 */
export const fordefiConfig: FordefiApiConfig = {
    chainId: 1337,  // Use 1337 for all actions except deposit (use 42161 for deposit)
    address: process.env.FORDEFI_EVM_VAULT_ADDRESS ?? '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73',
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
    agentAddress: "",
    agentName: "agent_smith",
    // validUntil: "1774777045175"
};

export const hyperliquidConfig: HyperliquidConfig = {
    action: "spotTransfer",
    isTestnet: false,
    destination: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
    amount: "5",
    token: "USDC:0x6d1e7cde53ba9467b783cb7c530ce054",
    toSpot: true,
    isDeposit: true,
    hyperliquid_vault_address: "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303",
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
