import { HyperliquidConfig, fordefiConfig } from './config';
import * as hl from "@nktkas/hyperliquid";
import { privateKeyToAccount } from 'viem/accounts';

const VAULT_ADDRESS = "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303";

/**
 * Vault transfer using Agent wallet (API wallet)
 *
 * Agent wallets are recommended for L1 Actions like vault transfers.
 * The agent wallet signs on behalf of the master account (fordefiConfig.address).
 *
 * IMPORTANT: The agent must be approved first by the master account.
 * The master account address goes in the vaultAddress parameter.
 */
export async function vault_transfer_agent(hyperliquidConfig: HyperliquidConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }

    if (!hyperliquidConfig.agentPk) {
        throw new Error("Agent private key (HYPERCORE_AGENT_PK) is required for this operation!");
    }

    try {
        // Validate amount is not empty
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }

        // Create agent wallet from private key
        const agentWallet = privateKeyToAccount(hyperliquidConfig.agentPk as `0x${string}`);
        console.log(`Agent wallet address: ${agentWallet.address}`);
        console.log(`Master account address: ${fordefiConfig.address}`);
        console.log(`Vault address: ${VAULT_ADDRESS}`);

        // Create transport
        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        // Create ExchangeClient with agent wallet
        // IMPORTANT: When using agent wallet, pass the MASTER ACCOUNT ADDRESS as vaultAddress
        const exchClient = new hl.ExchangeClient({
            wallet: agentWallet,
            transport,
            defaultVaultAddress: fordefiConfig.address.toLowerCase()
        });

        console.log("Exchange client created successfully");

        // Perform vault transfer
        // The agent signs on behalf of the master account (vaultAddress)
        const result = await exchClient.vaultTransfer({
            vaultAddress: VAULT_ADDRESS.toLowerCase() as `0x${string}`,
            isDeposit: hyperliquidConfig.isDeposit as boolean,
            usd: Number(hyperliquidConfig.amount) * 1e6,
        });

        console.log(`Vault transfer ${hyperliquidConfig.isDeposit ? 'deposit' : 'withdrawal'} successful:`, result);
        return result;

    } catch (error: any) {
        console.error("Error during Vault transfer:", error.message || String(error));
        throw error;
    }
}