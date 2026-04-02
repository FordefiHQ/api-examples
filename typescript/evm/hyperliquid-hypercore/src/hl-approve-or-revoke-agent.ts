import * as fs from 'fs';
import { ethers } from 'ethers';
import * as hl from "@nktkas/hyperliquid";
import { FordefiWalletAdapter, findSignatureOnlyError } from './wallet-adapter';
import { HyperliquidConfig, fordefiConfig, AgentWalletConfig } from './config';

export function generateAgentKeypair(agentName: string) {
    const wallet = ethers.Wallet.createRandom();
    const pk_name = `private_key_${agentName}`
    const privateKeyData = {
        [pk_name]: wallet.privateKey
    };
    fs.writeFileSync(
        'agent-private-key.json',
        JSON.stringify(privateKeyData, null, 2),
        'utf-8'
    );
    console.log('Address: ', wallet.address);

    return wallet.address;
}

export async function approveAgentWallet(hyperliquidConfig: HyperliquidConfig, agentWalletConfig: AgentWalletConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }
    // Create keypair for Agent wallet and format name
    agentWalletConfig.agentAddress= await generateAgentKeypair(agentWalletConfig.agentName)
    agentWalletConfig.agentName = agentWalletConfig.agentName + ` valid_until ${agentWalletConfig.validUntil}`
    console.log(`Agent address: ${agentWalletConfig.agentAddress}`)

    try {
        const wallet = new FordefiWalletAdapter(fordefiConfig);

        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });
        console.log("Exchange client created successfully");
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        const result = await exchClient.approveAgent({
            agentAddress: agentWalletConfig.agentAddress.toLowerCase() as `0x${string}`,
            agentName: agentWalletConfig.agentName
        });
        console.log("Agent added successfully: ", result);

    } catch (error: any) {
        const sigOnly = findSignatureOnlyError(error);
        if (sigOnly) {
            console.log("Signature obtained (not broadcast):", sigOnly.signature);
            return { signature: sigOnly.signature };
        }
        console.error("Error during agent operation:", error.message || String(error));
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    };
};

export async function revokeAgentWallet(hyperliquidConfig: HyperliquidConfig, agentWalletConfig: AgentWalletConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }

    try {
        const wallet = new FordefiWalletAdapter(fordefiConfig);

        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });
        console.log("Exchange client created successfully");
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        // remove agent
        const result = await exchClient.approveAgent({
            agentAddress: "0x0000000000000000000000000000000000000000",
            agentName: agentWalletConfig.agentName
        });
        console.log("Agent revoked successfully: ", result);

    } catch (error: any) {
        const sigOnly = findSignatureOnlyError(error);
        if (sigOnly) {
            console.log("Signature obtained (not broadcast):", sigOnly.signature);
            return { signature: sigOnly.signature };
        }
        console.error("Error during agent operation:", error.message || String(error));
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    };
};
