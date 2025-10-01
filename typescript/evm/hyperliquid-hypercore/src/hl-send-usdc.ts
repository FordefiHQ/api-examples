import { HyperliquidConfig, fordefiConfig } from './config'
import { getProvider } from './get-provider';
import * as hl from "@nktkas/hyperliquid";
import { ethers } from 'ethers';
import { FordefiWalletAdapter } from './wallet-adapter';

export async function usdSend(hyperliquidConfig: HyperliquidConfig) {
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
        // Validate destination address format
        if (!hyperliquidConfig.destination || !hyperliquidConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid EVM address starting with '0x'");
        }
        // Perform USDC transfer
        // IMPORTANT: Lowercase the destination address to avoid signature issues
        const result = await exchClient.usdSend({
            destination: hyperliquidConfig.destination.toLowerCase() as `0x${string}`,
            amount: String(hyperliquidConfig.amount),
        });
        console.log("USDC transfer successful: ", result);
        
    } catch (error: any) {
        console.error("Error during USDC transfer:", error.message || String(error));
    };
};