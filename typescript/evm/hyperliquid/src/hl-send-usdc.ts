import { HyperliquidConfig, fordefiConfig } from './config'
import { getProvider } from './get-provider';
import * as hl from "@nktkas/hyperliquid";
import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer";

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
                domain: TypedDataDomain, 
                types: Record<string, Array<TypedDataField>>,
                value: Record<string, any> 
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
        // Validate amount is not empty
        if (!hlConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
        // Validate destination address format
        if (!hlConfig.destination || !hlConfig.destination.startsWith('0x')) {
            throw new Error("Destination must be a valid Ethereum address starting with '0x'");
        }
        // Perform USDC transfer
        const result = await client.usdSend({
            destination: hlConfig.destination,
            amount: String(hlConfig.amount),
        });
        console.log("USDC transfer successful: ", result);
        
    } catch (error: any) {
        console.error("Error during USDC transfer:", error.message || String(error));
    };
};