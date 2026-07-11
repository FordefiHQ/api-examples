import { approveAgentWallet, revokeAgentWallet } from "./hl-approve-or-revoke-agent";
import { agentWalletConfig, fordefiConfig, hyperliquidConfig, orderConfig } from "./config";
import { vaultTransfer } from "./hl-vault-transfer";
import { spotTransfer } from "./hl-send-to-spot";
import { subAccountTransfer } from "./hl-subaccount-transfer";
import { placePerpsOrder } from './hl-place-perps-order';
import { withdraw } from "./hl-withdraw";
import { usdSend } from "./hl-send-usdc";
import { deposit } from "./hl-deposit";
import { dispatchAction, type ActionHandlers } from "./dispatcher";

const handlers: ActionHandlers = {
    deposit,
    withdraw,
    sendUsd: usdSend,
    vault_transfer: vaultTransfer,
    approve_agent: (config) => approveAgentWallet(config, agentWalletConfig),
    revoke_agent: (config) => revokeAgentWallet(config, agentWalletConfig),
    spotTransfer,
    subAccountTransfer,
    placeOrder: (config) => placePerpsOrder(config, orderConfig),
};

export async function main(): Promise<void> {
    const result = await dispatchAction(hyperliquidConfig, fordefiConfig.address, handlers);
    if (result !== undefined) console.log("Action result:", result);
}

void main().catch((error: unknown) => {
    console.error("Action failed:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.cause) console.error("Cause:", error.cause);
    process.exitCode = 1;
});
