import { ethers } from 'ethers';
import * as hl from "@nktkas/hyperliquid";
import { getProvider } from './get-provider';
import { FordefiWalletAdapter } from './wallet-adapter';
import { HyperliquidConfig, fordefiConfig } from './config';


export async function place_perps_order(hyperliquidConfig: HyperliquidConfig, orderConfig: hl.OrderParameters) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }
    try {
        if (!hyperliquidConfig.amount) {
            throw new Error("Amount is required and cannot be empty");
        }
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

        const info = new hl.InfoClient({ transport: transport });
        const mids = await info.allMids();

        const metaAndCtxs = await info.metaAndAssetCtxs();
        const assetIndex = orderConfig.orders[0]?.a ?? 0;
        const assetMeta = metaAndCtxs[0].universe[Number(assetIndex)];
        const assetName = assetMeta?.name;
        const midPrice = assetName ? mids[assetName] : undefined;

        console.log("Asset:", assetMeta);
        console.log("Mid price:", midPrice);

        // Round price to valid tick size (for BTC, ETH it's whole dollars)
        // HyperCore uses 5 significant figures for prices
        const roundToTickSize = (price: string): string => {
            const p = parseFloat(price);
            // For high-value assets like BTC, ETH, we round to nearest whole number
            if (p >= 1000) {
                return Math.round(p).toString();
            }
            // For smaller price we keep more precision
            return p.toPrecision(5);
        };

        // Update order price to mid price (rounded)
        if (orderConfig.orders[0] && midPrice) {
            orderConfig.orders[0].p = roundToTickSize(midPrice);
            console.log("Rounded price:", orderConfig.orders[0].p);
        }

        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });
        console.log("Exchange client created successfully");

        const result = await exchClient.order({
            ...orderConfig,
            grouping: "na",
        });

        console.log("Order result: ", result)
        return result;

    } catch (error: any) {
        console.error("Error while placing order:", error.message || String(error));
        throw error;
    }
}