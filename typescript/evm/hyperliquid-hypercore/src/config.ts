import fs from 'fs';
import dotenv from 'dotenv';
import { FordefiProviderConfig } from '@fordefi/web3-provider';

dotenv.config()

export interface HyperliquidConfig { 
    action: "deposit" | "withdraw" | "sendUsd" | "vault_transfer" | "approve_agent" | "revoke_agent"
    isTestnet: boolean,
    destination?: `0x${string}`,
    amount?: string,
    agentPk?: string
    isDeposit?: boolean,
    hyperliquid_vault_address?: string
}

export interface AgentWalletConfig { 
    agentAddress: string,
    agentName: string,
    validUntil?: string
}

// Configure the Fordefi provider
export const fordefiConfig: FordefiProviderConfig = {
    chainId: 42161, // Arbitrum -> 42161
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://1rpc.io/arb',
    skipPrediction: false 
};

export const agentWalletConfig: AgentWalletConfig = {
    agentAddress: "", // always leave empty
    agentName: "agent_daisy",
    validUntil: "1774777045175" // only required when approving an agent, MAX is 180 days in UNIX time
};

export const hyperliquidConfig: HyperliquidConfig = {
    action: "vault_transfer",
    isTestnet: false,
    destination: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73", // Change to your destination address
    amount: "10",
    agentPk: JSON.parse(fs.readFileSync('./agent-private-key.json', 'utf8'))[`private_key_${agentWalletConfig.agentName}`] ?? (() => { throw new Error('API Agent private key is not set'); })(), // only required for L1 actions
    isDeposit: false, // only required when for "vault_transfer" action
    hyperliquid_vault_address: "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303" // only required when for "vault_transfer" action
};