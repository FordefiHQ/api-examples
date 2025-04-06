import { HyperliquidConfig, fordefiConfig } from './config'
import { getProvider } from './get-provider';
import * as hl from "@nktkas/hyperliquid";

export async function usdSend(hlConfig: HyperliquidConfig) {
    if (!hlConfig) {
        throw new Error("Config required!");
    }
    try {
        // Get the singleton provider
        const provider = await getProvider();
        if (!provider) {
            throw new Error("Failed to initialize provider");
        };

        // Instanciate transport
        const transport = new hl.HttpTransport();

        // This custom signer ensures we're using the correct chainId to construct the message we'll sign
        const customSigner = {
            getAddress: async () => fordefiConfig.address,
            signTypedData: async (
                domain:any, 
                types:any, 
                value:any
            ) => 
                {
                    const modifiedDomain = {
                        ...domain,
                        chainId: fordefiConfig.chainId
                    };
                    const signer = await provider.getSigner();
                    return signer._signTypedData(
                        modifiedDomain,
                        types,
                        value
                    );
                }
        };

        // Create a Hyperliquid wallet client using the Fordefi provider
        const client = new hl.WalletClient({ 
            wallet: customSigner, 
            transport 
        });
        console.log("Wallet client created successfully");

        // Account clearinghouse state
        const result = await client.usdSend({
            destination: hlConfig.destination as `0x${string}`,
            amount: String(hlConfig.amount || '1'),
        });
        console.log("USDC transfer successful: ", result);
        
    } catch (error: any) {
        console.error("Error during USDC transfer:", error.message || String(error));
    };
};