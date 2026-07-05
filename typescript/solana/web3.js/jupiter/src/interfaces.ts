export interface FordefiConfig {
  accessToken: string;
  vaultId: string;
  fordefiSolanaVaultAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
}

export interface SwapConfig {
  swapAmount: string;
  slippage: string;
  inputToken: string;
  outputToken: string;
  jupiterApiKey: string
}

export interface JupiterOrderResponse {
    requestId: string;
    transaction: string;
    inAmount?: string;
    outAmount?: string;
    inputMint?: string;
    outputMint?: string;
}

export interface JupiterSwapResult {
    fordefiRequestBody: object;
    requestId: string;
}