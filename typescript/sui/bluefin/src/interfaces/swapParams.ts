export interface SwapParams {
    poolId: string;          // Bluefin Pool ID
    amount: number;          // Amount in MIST
    aToB: boolean;          // Swap direction (true = SUI to USDC)
    byAmountIn: boolean;    // Whether amount is input or output
    slippageProtection: number; // Minimum amount to receive
    maximumSqrt: string;    // Maximum sqrt price after swap
    gasBudget: number;      // Maximum gas in MIST
    gasPrice: number;       // Gas price in MIST
}