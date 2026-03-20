export interface IntentsConfig {
    originAsset: string;        // 1Click asset ID, e.g. "near:mainnet:native"
    destinationAsset: string;   // 1Click asset ID, e.g. "eth:1:native"
    amount: string;             // Amount in smallest unit of origin asset
    recipient: string;          // Destination address on target chain
    slippage: number;           // Basis points, e.g. 100 = 1%
    apiKey?: string;            // Optional 1Click API key (avoids 0.1% fee)
}

export interface ParsedAssetId {
    chain: string;              // e.g. "near", "eth"
    network: string;            // e.g. "mainnet", "1"
    address: string;            // e.g. "native", "wrap.near", "usdt.tether-token.near"
    isNativeNear: boolean;
}

export interface OneClickQuoteRequest {
    dry: boolean;
    swapType: "EXACT_INPUT" | "EXACT_OUTPUT" | "FLEX_INPUT" | "ANY_INPUT";
    originAsset: string;
    destinationAsset: string;
    amount: string;
    recipient: string;
    refundTo: string;
    depositType: "ORIGIN_CHAIN" | "INTENTS";
    recipientType: "DESTINATION_CHAIN" | "INTENTS";
    refundType: "ORIGIN_CHAIN" | "INTENTS";
    deadline: string;
    slippageTolerance?: number;
    referral?: string;
}

export interface OneClickQuoteResponse {
    correlationId: string;
    timestamp: string;
    quote: {
        depositAddress: string;
        depositMemo: string | null;
        amountIn: string;
        amountInFormatted: string;
        amountOut: string;
        amountOutFormatted: string;
        amountOutUsd: string;
        minAmountOut?: string;
        deadline: string;
        timeEstimate: number;
    };
}

export interface OneClickToken {
    assetId: string;
    symbol: string;
    name: string;
    decimals: number;
    blockchain: string;
    address?: string;
}

export type OneClickStatus =
    | "PENDING_DEPOSIT"
    | "PROCESSING"
    | "SUCCESS"
    | "FAILED"
    | "REFUNDED"
    | "INCOMPLETE_DEPOSIT";

export interface OneClickStatusResponse {
    correlationId: string;
    status: OneClickStatus;
    updatedAt: string;
    swapDetails: {
        amountIn: string;
        amountInFormatted: string;
        amountOut: string;
        amountOutFormatted: string;
        slippage: number;
        originChainTxHashes: Array<{ hash: string; explorerUrl: string }>;
        destinationChainTxHashes: Array<{ hash: string; explorerUrl: string }>;
        refundedAmount?: string;
        refundReason?: string;
    };
}
