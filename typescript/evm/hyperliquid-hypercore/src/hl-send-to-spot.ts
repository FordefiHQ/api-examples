import { FordefiProviderConfig } from '@fordefi/web3-provider';
import { FordefiWalletAdapter } from './wallet-adapter';
import { HyperliquidConfig } from './config';
import { getProvider } from './get-provider';
import * as hl from "@nktkas/hyperliquid";
import { ethers } from 'ethers';


export async function spotTransfer(hyperliquidConfig: HyperliquidConfig, fordefiConfig: FordefiProviderConfig) {
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

        const wallet = new FordefiWalletAdapter(signer, fordefiConfig.address);

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
        if (!hyperliquidConfig.destination || !hyperliquidConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid EVM address starting with '0x'");
        }

        // Determine transfer direction based on toSpot flag
        const toSpot = hyperliquidConfig.toSpot ?? true; // Default to Perps→Spot
        const sourceDex = toSpot ? "" : "spot";
        const destinationDex = toSpot ? "spot" : "";
        const direction = toSpot ? "Perps → Spot" : "Spot → Perps";

        const result = await exchClient.sendAsset({
            destination: fordefiConfig.address,
            sourceDex,
            destinationDex,
            token: hyperliquidConfig.token!,
            amount: String(hyperliquidConfig.amount),
        });
        console.log(`Successfully transferred ${hyperliquidConfig.amount} ${hyperliquidConfig.token} (${direction}):`, result);

    } catch (error: any) {
        console.error("Error during asset transfer:", error.message || String(error));
    };
};