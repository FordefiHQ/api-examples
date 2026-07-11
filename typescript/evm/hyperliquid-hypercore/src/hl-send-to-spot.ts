import { fordefiConfig } from "./config";
import type { SpotTransferActionConfig } from "./interfaces";
import { createExchangeClient, executeHyperliquidAction } from "./hyperliquid-client";

export async function spotTransfer(config: SpotTransferActionConfig) {
    return executeHyperliquidAction(async () => {
        const sourceDex = config.toSpot ? "" : "spot";
        const destinationDex = config.toSpot ? "spot" : "";
        const result = await createExchangeClient(config.isTestnet, fordefiConfig).sendAsset({
            destination: fordefiConfig.address,
            sourceDex,
            destinationDex,
            token: config.token,
            amount: config.amount,
        });
        console.log(`Transferred ${config.amount} ${config.token} (${config.toSpot ? "Perps → Spot" : "Spot → Perps"})`);
        return result;
    });
}
