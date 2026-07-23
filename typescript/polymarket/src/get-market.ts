import { ClobClient } from "@polymarket/clob-client-v2";

export async function getRecentMarket(client: ClobClient) {
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 50; page++) {
        const markets = await client.getSimplifiedMarkets(cursor);
        const activeMarket = markets.data.find((m: any) =>
            m.active === true &&
            m.closed === false &&
            m.accepting_orders === true &&
            // only markets with a real two-sided price — 0/0.5/1 placeholders
            // are stale or unresolved entries the CLOB may reject
            m.tokens?.some((t: any) => t.price > 0.01 && t.price < 0.99 && t.price !== 0.5)
        );
        if (activeMarket) {
            return activeMarket;
        }
        if (!markets.next_cursor || markets.next_cursor === "LTE=") { // "LTE=" means the end
            break;
        }
        cursor = markets.next_cursor;
    }
    throw new Error("No active markets found");
}
