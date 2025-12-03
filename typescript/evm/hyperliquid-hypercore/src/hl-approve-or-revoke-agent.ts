import * as fs from 'fs';
import { ethers } from 'ethers';
import * as hl from "@nktkas/hyperliquid";
import { getProvider } from './get-provider';
import { FordefiWalletAdapter } from './wallet-adapter';
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
        let provider = await getProvider(fordefiConfig);
        if (!provider) {
          throw new Error("Failed to initialize provider");
        }
        let web3Provider = new ethers.BrowserProvider(provider);
        const signer = await web3Provider.getSigner();

        // Create custom wallet adapter
        const wallet = new FordefiWalletAdapter(signer, fordefiConfig.address);

        // Instantiate transport
        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        // Create ExchangeClient with the custom wallet
        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539' 
        });
        console.log("Exchange client created successfully");
        // Validate amount is not empty
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        // Add agent
        const result = await exchClient.approveAgent({
            agentAddress: agentWalletConfig.agentAddress.toLowerCase() as `0x${string}`,
            agentName: agentWalletConfig.agentName
        });
        console.log("Agent added successfully: ", result);
        
    } catch (error: any) {
        console.error("Error during agent operation:", error.message || String(error));
    };
};

export async function revokeAgentWallet(hyperliquidConfig: HyperliquidConfig, agentWalletConfig: AgentWalletConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }

    try {
        let provider = await getProvider(fordefiConfig);
        if (!provider) {
          throw new Error("Failed to initialize provider");
        }
        let web3Provider = new ethers.BrowserProvider(provider);
        const signer = await web3Provider.getSigner();

        // Create custom wallet adapter
        const wallet = new FordefiWalletAdapter(signer, fordefiConfig.address);

        // Instantiate transport
        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        // Create ExchangeClient with the custom wallet
        // IMPORTANT: Must explicitly set signatureChainId for Arbitrum in hex (0xa4b1)
        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0xa4b1' 
        });
        console.log("Exchange client created successfully");
        // Validate amount is not empty
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        // Remove agent
        const result = await exchClient.approveAgent({
            agentAddress: "0x0000000000000000000000000000000000000000",
            agentName: agentWalletConfig.agentName
        });
        console.log("Agent revoked successfully: ", result);
        
    } catch (error: any) {
        console.error("Error during agent operation:", error.message || String(error));
    };
};