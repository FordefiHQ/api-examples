import { fordefiConfig } from "./config";
import type { VaultTransferActionConfig } from "./interfaces";
import { createExchangeClient, executeHyperliquidAction } from "./hyperliquid-client";
import { parseUsdMicros } from "./validation";

export async function vaultTransfer(config: VaultTransferActionConfig) {
    return executeHyperliquidAction(async () => {
        const result = await createExchangeClient(config.isTestnet, fordefiConfig).vaultTransfer({
            vaultAddress: config.hyperliquidVaultAddress.toLowerCase() as `0x${string}`,
            isDeposit: config.isDeposit,
            usd: parseUsdMicros(config.amount),
        });
        console.log(`Vault ${config.isDeposit ? "deposit" : "withdrawal"} successful`);
        return result;
    });
}
