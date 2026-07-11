import { fordefiConfig } from "./config";
import type { AddressAmountActionConfig } from "./interfaces";
import { createExchangeClient, executeHyperliquidAction } from "./hyperliquid-client";

export async function usdSend(config: AddressAmountActionConfig<"sendUsd">) {
    return executeHyperliquidAction(async () => {
        const result = await createExchangeClient(config.isTestnet, fordefiConfig).usdSend({
            destination: config.destination.toLowerCase() as `0x${string}`,
            amount: config.amount,
        });
        console.log("USDC transfer successful");
        return result;
    });
}
