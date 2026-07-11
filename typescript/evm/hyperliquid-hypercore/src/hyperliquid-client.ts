import * as hl from "@nktkas/hyperliquid";
import type { FordefiApiConfig, SignatureOnlyResult } from "./interfaces";
import { FordefiWalletAdapter, findSignatureOnlyError } from "./wallet-adapter";

export function createExchangeClient(isTestnet: boolean, fordefiConfig: FordefiApiConfig): hl.ExchangeClient {
    return new hl.ExchangeClient({
        wallet: new FordefiWalletAdapter(fordefiConfig),
        transport: new hl.HttpTransport({ isTestnet }),
        signatureChainId: "0x539",
    });
}

export function createInfoClient(isTestnet: boolean): hl.InfoClient {
    return new hl.InfoClient({ transport: new hl.HttpTransport({ isTestnet }) });
}

export async function executeHyperliquidAction<T>(operation: () => Promise<T>): Promise<T | SignatureOnlyResult> {
    try {
        return await operation();
    } catch (error) {
        const signatureOnly = findSignatureOnlyError(error);
        if (signatureOnly) return { signature: signatureOnly.signature, broadcast: false };
        throw error;
    }
}
