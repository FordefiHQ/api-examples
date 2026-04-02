import * as hl from "@nktkas/hyperliquid";
import { FordefiWalletAdapter } from './wallet-adapter';
import { HyperliquidConfig, fordefiConfig } from './config'

export async function withdraw3(hyperliquidConfig: HyperliquidConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }
    try {
        const wallet = new FordefiWalletAdapter(fordefiConfig);

        const transport = new hl.HttpTransport();

        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });
        console.log("Exchange client created successfully");

        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        if (!hyperliquidConfig.destination || !hyperliquidConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid Ethereum address starting with '0x'");
        }

        const result = await exchClient.withdraw3({
            destination: hyperliquidConfig.destination.toLowerCase() as `0x${string}`,
            amount: String(hyperliquidConfig.amount),
        });
        console.log("Withdrawal successful:", result);

    } catch (error: any) {

        const errorMessage = error.message || String(error);

        if (errorMessage.includes("Insufficient balance")) {
            console.error("ERROR: Not enough funds for withdrawal");
        } else if (errorMessage.includes("provider") || errorMessage.includes("connect")) {
            console.error("ERROR: Provider connection issue");
        } else {
            console.error("ERROR:", errorMessage);
        };
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    };
};
