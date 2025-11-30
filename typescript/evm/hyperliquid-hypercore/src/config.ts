import fs from 'fs';
import dotenv from 'dotenv';
import { FordefiProviderConfig } from '@fordefi/web3-provider';

dotenv.config()

export interface HyperliquidConfig {
    action: "deposit" | "withdraw" | "sendUsd" | "vault_transfer" | "approve_agent" | "revoke_agent" | "spotTransfer"
    isTestnet: boolean,
    destination?: `0x${string}`, // destination address when using a "sendUsd" action
    amount?: string,  // only required for "vault_transfer" action
    token?: string,   // only required for a "spotTransfer" action
    agentPk?: string  // optional as it's ONLY required for L1 actions that must be performed by agent wallets
    isDeposit?: boolean, // only required for a "vault_transfer" action
    hyperliquid_vault_address?: string
    toSpot?: boolean  // only required for a "spotTransfer" action: true = Perps→Spot, false = Spot→Perps
}

export interface AgentWalletConfig { 
    agentAddress: string,
    agentName: string,
    validUntil?: string // only required for a "approve_agent" action, MAX is 180 days in UNIX time
}

// Configure the Fordefi provider
export const fordefiConfig: FordefiProviderConfig = {
    chainId: 42161, // Arbitrum -> 42161
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./secret/private.pem', 'utf8') ?? (() => { throw new Error('API User private key is not set!'); })(),
    rpcUrl: 'https://1rpc.io/arb',
    skipPrediction: false 
};

export const agentWalletConfig: AgentWalletConfig = {
    agentAddress: "", // always leave empty
    agentName: "agent_smith",
    //validUntil: "1774777045175"
};

export const hyperliquidConfig: HyperliquidConfig = {
    action: "spotTransfer",
    isTestnet: false,
    destination: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
    amount: "2",
    token: "USDC:0x6d1e7cde53ba9467b783cb7c530ce054", // USDC on HyperCore
    toSpot: false, // true = Perps→Spot, false = Spot→Perps
    //agentPk: JSON.parse(fs.readFileSync('./agent-private-key.json', 'utf8'))[`private_key_${agentWalletConfig.agentName}`] ?? (() => { throw new Error('API Agent private key is not set'); })(),
    //isDeposit: true,
    //hyperliquid_vault_address: "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303"
};