import { ethers } from 'ethers';
import * as hl from "@nktkas/hyperliquid";
import { getProvider } from './get-provider';
import { FordefiWalletAdapter } from './wallet-adapter';
import { HyperliquidConfig, fordefiConfig } from './config'

export async function withdraw3(hyperliquidConfig: HyperliquidConfig) {
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
        const transport = new hl.HttpTransport();

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
        // Validate destination address format
        if (!hyperliquidConfig.destination || !hyperliquidConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid Ethereum address starting with '0x'");
        }
        // Account clearinghouse state
        const result = await exchClient.withdraw3({
            destination: hyperliquidConfig.destination.toLowerCase() as `0x${string}`,
            amount: String(hyperliquidConfig.amount),
        });
        console.log("Withdrawal successful:", result);
        
    } catch (error: any) {

        const errorMessage = error.message || String(error);
        
        if (errorMessage.includes("Insufficient balance")) {
            console.error("ERROR: Not enough funds for withdrawal");
        } else if (errorMessage.includes("provider") || errorMessage.includes("connect")) {
            console.error("ERROR: Provider connection issue");
        } else {
            console.error("ERROR:", errorMessage);
        };
    };
};