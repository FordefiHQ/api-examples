import { approveAgentWallet, revokeAgentWallet } from "./hl-approve-or-revoke-agent";
import { hyperliquidConfig, fordefiConfig, agentWalletConfig } from "./config";
import { vault_transfer_agent } from "./hl-vault-transfer-agent";
import { spotTransfer } from "./hl-send-to-spot";
import { withdraw3 } from "./hl-withdraw";
import { usdSend } from "./hl-send-usdc";
import { deposit } from "./hl-deposit";

async function main() {
    try {
        if (hyperliquidConfig.action == "deposit"){
            await deposit(hyperliquidConfig)
        } else if (hyperliquidConfig.action == "withdraw"){
            await withdraw3(hyperliquidConfig)
        } else if (hyperliquidConfig.action == "vault_transfer"){
            await vault_transfer_agent(hyperliquidConfig)
        } else if (hyperliquidConfig.action == "approve_agent") {
            await approveAgentWallet(hyperliquidConfig, agentWalletConfig)
        } else if (hyperliquidConfig.action == "revoke_agent") {
            await revokeAgentWallet(hyperliquidConfig, agentWalletConfig) 
        } else if (hyperliquidConfig.action == "spotTransfer") {
            await spotTransfer(hyperliquidConfig, fordefiConfig) 
        } else {
            await usdSend(hyperliquidConfig)
        }
    } catch (error) {
        console.error("Oops, an error occured: ", error)
    }
} 

main().catch(error => {
    console.error("Unhandled error:", error);
});