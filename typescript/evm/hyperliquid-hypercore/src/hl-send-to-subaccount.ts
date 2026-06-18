import { HyperliquidConfig, fordefiConfig } from './config'
import * as hl from "@nktkas/hyperliquid";
import { FordefiWalletAdapter, findSignatureOnlyError } from './wallet-adapter';

export async function sendToSubAccount(hyperliquidConfig: HyperliquidConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }
    try {
        const wallet = new FordefiWalletAdapter(fordefiConfig);

        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }

        if (!hyperliquidConfig.destination || !hyperliquidConfig.destination.startsWith('0x')) {
            throw new Error("Destination (subaccount address) must be a valid EVM address starting with '0x'");
        }

        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });
        console.log("Exchange client created successfully");

        // true = main -> subaccount (deposit), false = subaccount -> main (withdraw)
        const isDeposit = hyperliquidConfig.subAccountDeposit ?? true;
        const direction = isDeposit ? "Main → Subaccount" : "Subaccount → Main";
        const subAccountUser = hyperliquidConfig.destination.toLowerCase() as `0x${string}`;

        // toSpot=true transfers the Spot balance, toSpot=false transfers the Perps balance
        if (hyperliquidConfig.toSpot) {
            // Spot transfer — amount is passed as-is (not scaled), token is required
            if (!hyperliquidConfig.token) {
                throw new Error("token is required for a Spot subaccount transfer (format: 'TOKEN:address')");
            }
            const result = await exchClient.subAccountSpotTransfer({
                subAccountUser,
                isDeposit,
                token: hyperliquidConfig.token,
                amount: String(hyperliquidConfig.amount),
            });
            console.log(`Successfully transferred ${hyperliquidConfig.amount} ${hyperliquidConfig.token} (Spot, ${direction}):`, result);
        } else {
            // Perps transfer — USDC amount expressed as integer micro-USD (float * 1e6)
            const usd = Math.round(parseFloat(String(hyperliquidConfig.amount)) * 1e6);
            const result = await exchClient.subAccountTransfer({
                subAccountUser,
                isDeposit,
                usd,
            });
            console.log(`Successfully transferred ${hyperliquidConfig.amount} USDC (Perps, ${direction}):`, result);
        }

    } catch (error: any) {
        const sigOnly = findSignatureOnlyError(error);
        if (sigOnly) {
            console.log("Signature obtained (not broadcast):", sigOnly.signature);
            return { signature: sigOnly.signature };
        }
        console.error("Error during subaccount transfer:", error.message || String(error));
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    };
};
