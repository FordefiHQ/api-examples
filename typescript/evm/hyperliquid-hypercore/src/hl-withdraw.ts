import { ethers, parseUnits, formatUnits } from 'ethers';
import { HyperliquidConfig, fordefiConfig } from './config'
import { getProvider } from './get-provider';
import * as hl from "@nktkas/hyperliquid";
import { FordefiWalletAdapter } from './wallet-adapter';

export async function withdraw3(hlConfig: HyperliquidConfig) {
    if (!hlConfig) {
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
            transport 
        });
        console.log("Exchange client created successfully");

        // Validate amount is not empty
        if (!hlConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        // Validate destination address format
        if (!hlConfig.destination || !hlConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid Ethereum address starting with '0x'");
        }
        // Account clearinghouse state
        const result = await exchClient.withdraw3({
            destination: hlConfig.destination, // Withdraw funds to your Fordefi EVM vault
            amount: String(hlConfig.amount),
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