import * as hl from "@nktkas/hyperliquid";
import { FordefiWalletAdapter } from './wallet-adapter';
import { HyperliquidConfig, fordefiConfig } from './config';


export async function vault_transfer_agent(hyperliquidConfig: HyperliquidConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }

    try {
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }

        const wallet = new FordefiWalletAdapter(fordefiConfig);

        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });

        console.log("Exchange client created successfully");

        const result = await exchClient.vaultTransfer({
            vaultAddress: hyperliquidConfig.hyperliquid_vault_address!.toLowerCase() as `0x${string}`,
            isDeposit: hyperliquidConfig.isDeposit as boolean,
            usd: Number(hyperliquidConfig.amount) * 1e6,
        });

        console.log(`Vault transfer ${hyperliquidConfig.isDeposit ? 'deposit' : 'withdrawal'} successful:`, result);
        return result;

    } catch (error: any) {
        console.error("Error during Vault transfer:", error.message || String(error));
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
        throw error;
    }
}
