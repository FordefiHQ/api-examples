import fs from 'fs';
import dotenv from 'dotenv';
import { OrderParameters } from "@nktkas/hyperliquid";
import { FordefiProviderConfig } from '@fordefi/web3-provider';

dotenv.config()

export interface HyperliquidConfig {
    action: "deposit" | "withdraw" | "sendUsd" | "vault_transfer" | "approve_agent" | "revoke_agent" | "spotTransfer" | "placeOrder"
    isTestnet: boolean,
    destination?: `0x${string}`,
    amount?: string,
    token?: string,               // Required for "spotTransfer" action (format: "TOKEN:address")
    isDeposit?: boolean,          // Required for "vault_transfer" action
    hyperliquid_vault_address?: string
    toSpot?: boolean              // Required for "spotTransfer": true = Perps→Spot, false = Spot→Perps
}

export interface AgentWalletConfig { 
    agentAddress: string,
    agentName: string,
    validUntil?: string // only required for a "approve_agent" action, MAX is 180 days in UNIX time
}

/**
 * Fordefi Provider Configuration
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
 * Recommendation: Use chainId 1337 (0x539) for most actions, switch to 42161 only for deposits.
 */
export const fordefiConfig: FordefiProviderConfig = {
    chainId: 1337,  // Use 1337 for all actions except deposit (use 42161 for deposit)
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // Your Fordefi EVM Vault address
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(),
    apiPayloadSignKey: fs.readFileSync('./secret/private.pem', 'utf8') ?? (() => { throw new Error('API User private key is not set!'); })(),
    rpcUrl: 'https://1rpc.io/arb',
    skipPrediction: false
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
    action: "vault_transfer",
    isTestnet: false,
    destination: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
    amount: "1",
    token: "USDC:0x6d1e7cde53ba9467b783cb7c530ce054",
    toSpot: true,
    isDeposit: true,
    hyperliquid_vault_address: "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303"
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