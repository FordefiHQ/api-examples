import { fordefiConfig } from "./config";
import type { AddressAmountActionConfig } from "./interfaces";
import { createExchangeClient, executeHyperliquidAction } from "./hyperliquid-client";

export async function withdraw(config: AddressAmountActionConfig<"withdraw">) {
    return executeHyperliquidAction(async () => {
        const result = await createExchangeClient(config.isTestnet, fordefiConfig).withdraw3({
            destination: config.destination.toLowerCase() as `0x${string}`,
            amount: config.amount,
        });
        console.log("Withdrawal successful");
        return result;
    });
}
