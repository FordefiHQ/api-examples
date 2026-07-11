import type * as hl from "@nktkas/hyperliquid";
import { fordefiConfig } from "./config";
import type { SimpleActionConfig } from "./interfaces";
import { createExchangeClient, createInfoClient, executeHyperliquidAction } from "./hyperliquid-client";
import { formatPerpsOrder } from "./order-utils";

export async function placePerpsOrder(config: SimpleActionConfig<"placeOrder">, orderConfig: hl.OrderParameters) {
    return executeHyperliquidAction(async () => {
        const info = createInfoClient(config.isTestnet);
        const [mids, metaAndContexts] = await Promise.all([info.allMids(), info.metaAndAssetCtxs()]);
        const assetIndex = orderConfig.orders[0]?.a;
        if (assetIndex === undefined) throw new Error("At least one order with an asset index is required");
        const asset = metaAndContexts[0].universe[Number(assetIndex)];
        if (!asset) throw new Error(`No Hyperliquid metadata found for asset index ${assetIndex}`);
        const midPrice = mids[asset.name];
        if (!midPrice) throw new Error(`No midpoint available for ${asset.name}`);

        const formatted = formatPerpsOrder(orderConfig, midPrice, asset.szDecimals);
        const result = await createExchangeClient(config.isTestnet, fordefiConfig).order({ ...formatted, grouping: "na" });
        console.log(`Perpetual order submitted for ${asset.name} at ${formatted.orders[0]?.p}`);
        return result;
    });
}
