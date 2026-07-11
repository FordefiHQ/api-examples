import { fordefiConfig } from "./config";
import type { AgentWalletConfig, SimpleActionConfig } from "./interfaces";
import { buildAgentName, generateAgentKeypair } from "./agent-key";
import { createExchangeClient, executeHyperliquidAction } from "./hyperliquid-client";
import { validateAddress } from "./validation";

export async function approveAgentWallet(
    config: SimpleActionConfig<"approve_agent">,
    agentConfig: AgentWalletConfig,
) {
    const agentAddress = agentConfig.agentAddress
        ? validateAddress(agentConfig.agentAddress, "agentAddress")
        : generateAgentKeypair(
            agentConfig.agentName,
            agentConfig.privateKeyOutputPath ?? `./secret/agent-private-key-${agentConfig.agentName}.json`,
        );
    const agentName = buildAgentName(agentConfig.agentName, agentConfig.validUntil);

    return executeHyperliquidAction(async () => {
        const result = await createExchangeClient(config.isTestnet, fordefiConfig).approveAgent({
            agentAddress: agentAddress.toLowerCase() as `0x${string}`,
            agentName,
        });
        console.log(`Agent approved: ${agentAddress}`);
        return result;
    });
}

export async function revokeAgentWallet(
    config: SimpleActionConfig<"revoke_agent">,
    agentConfig: AgentWalletConfig,
) {
    return executeHyperliquidAction(async () => {
        const result = await createExchangeClient(config.isTestnet, fordefiConfig).approveAgent({
            agentAddress: "0x0000000000000000000000000000000000000000",
            agentName: buildAgentName(agentConfig.agentName),
        });
        console.log("Agent revoked successfully");
        return result;
    });
}
