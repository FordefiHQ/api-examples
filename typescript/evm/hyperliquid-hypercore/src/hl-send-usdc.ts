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
        const exchClient = new hl.ExchangeClient({ 
            wallet, 
            transport 
        });
        console.log("Exchange client created successfully");
        // Validate amount is not empty
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        // Validate destination address format
        if (!hyperliquidConfig.destination || !hyperliquidConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid Ethereum address starting with '0x'");
        }
        // Perform USDC transfer
        const result = await exchClient.usdSend({
            destination: hyperliquidConfig.destination,
            amount: String(hyperliquidConfig.amount),
        });
        console.log("USDC transfer successful: ", result);
        
    } catch (error: any) {
        console.error("Error during USDC transfer:", error.message || String(error));
    };
};