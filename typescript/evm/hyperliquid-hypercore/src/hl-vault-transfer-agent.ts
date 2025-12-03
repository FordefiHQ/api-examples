import { ethers } from 'ethers';
import * as hl from "@nktkas/hyperliquid";
import { getProvider } from './get-provider';
import { privateKeyToAccount } from 'viem/accounts';
import { FordefiWalletAdapter } from './wallet-adapter';;
import { HyperliquidConfig, fordefiConfig } from './config';

/**
 * Vault transfer using Fordefi wallet
 *
 * Fordefi now supports chainId 1337 signing, so L1 Actions like vault transfers
 * can be performed directly with your Fordefi vault - no agent wallet required.
 *
 * Note: Agent wallets are still supported as an alternative if needed,
 * but are no longer required for L1 Actions.
 */
export async function vault_transfer_agent(hyperliquidConfig: HyperliquidConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }

    // if (!hyperliquidConfig.agentPk) {
    //     throw new Error("An agent wallet private key is required for this operation, please approve an agent wallet first!");
    // }

    try {
        // Validate amount is not empty
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        let provider = await getProvider(fordefiConfig);
        if (!provider) {
            throw new Error("Failed to initialize provider");
        }
        let web3Provider = new ethers.BrowserProvider(provider);
        const signer = await web3Provider.getSigner();

        // Create custom wallet adapter
        const wallet = new FordefiWalletAdapter(signer, fordefiConfig.address);

        // Create transport
        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        // signatureChainId 0x539 (1337) is required for vault transfers
        // The wallet adapter will use fordefiConfig.chainId for signing
        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });

        console.log("Exchange client created successfully");

        // Perform vault transfer
        const result = await exchClient.vaultTransfer({
            vaultAddress: hyperliquidConfig.hyperliquid_vault_address!.toLowerCase() as `0x${string}`,
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