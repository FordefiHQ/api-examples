import { HyperliquidConfig, fordefiConfig } from './config'
import * as hl from "@nktkas/hyperliquid";
import { FordefiWalletAdapter, findSignatureOnlyError } from './wallet-adapter';

export async function usdSend(hyperliquidConfig: HyperliquidConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }
    try {
        const wallet = new FordefiWalletAdapter(fordefiConfig);

        // Validate amount is not empty
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        // Validate destination address format
        if (!hyperliquidConfig.destination || !hyperliquidConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid EVM address starting with '0x'");
        }

        // Instantiate transport
        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        // Create ExchangeClient
        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });
        console.log("Exchange client created successfully");

        // Perform USDC transfer
        const result = await exchClient.usdSend({
            destination: hyperliquidConfig.destination.toLowerCase() as `0x${string}`,
            amount: String(hyperliquidConfig.amount),
        });
        console.log("USDC transfer successful: ", result);

    } catch (error: any) {
        const sigOnly = findSignatureOnlyError(error);
        if (sigOnly) {
            console.log("Signature obtained (not broadcast):", sigOnly.signature);
            return { signature: sigOnly.signature };
        }
        console.error("Error during USDC transfer:", error.message || String(error));
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    };
};
