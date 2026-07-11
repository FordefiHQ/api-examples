import type { OrderParameters } from "@nktkas/hyperliquid";
import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";

export function formatPerpsOrder(
    orderConfig: OrderParameters,
    midPrice: string,
    sizeDecimals: number,
): OrderParameters {
    if (orderConfig.orders.length !== 1) throw new Error("This example supports exactly one order at a time");
    return {
        ...orderConfig,
        orders: orderConfig.orders.map((order) => ({
            ...order,
            p: formatPrice(midPrice, sizeDecimals, "perp"),
            s: formatSize(order.s, sizeDecimals),
        })),
    };
}
