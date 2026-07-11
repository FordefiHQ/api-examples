import type { SubAccountTransferActionConfig, TransferMarket } from "./interfaces";
import { fordefiConfig } from "./config";
import type * as hl from "@nktkas/hyperliquid";
import { createExchangeClient, executeHyperliquidAction } from "./hyperliquid-client";
import { parseUsdMicros } from "./validation";

async function transferLeg(
    client: hl.ExchangeClient,
    market: TransferMarket,
    subAccountUser: `0x${string}`,
    isDeposit: boolean,
    amount: string,
    token?: string,
) {
    if (market === "spot") {
        if (!token) throw new Error("A token is required for a spot sub-account transfer");
        return client.subAccountSpotTransfer({ subAccountUser, isDeposit, token, amount });
    }
    return client.subAccountTransfer({ subAccountUser, isDeposit, usd: parseUsdMicros(amount, "transfer.amount") });
}

export async function subAccountTransfer(config: SubAccountTransferActionConfig) {
    return executeHyperliquidAction(async () => {
        const { market, from, to, amount, token } = config.transfer;
        const fromMaster = from === "master";
        const subAccount = (fromMaster ? to : from) as `0x${string}`;
        const result = await transferLeg(
            createExchangeClient(config.isTestnet, fordefiConfig),
            market,
            subAccount.toLowerCase() as `0x${string}`,
            fromMaster,
            amount,
            token,
        );
        console.log(`Sub-account transfer successful (${fromMaster ? "Master → Subaccount" : "Subaccount → Master"})`);
        return result;
    });
}
