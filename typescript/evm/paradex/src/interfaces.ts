import { Call } from "starknet";
import { ParadexClient } from "@paradex/sdk";

export interface ParadexAction {
  action: "balance" | "withdraw-layerswap"
  amountToWithdraw: string
  // Layerswap config (required for withdraw-layerswap)
  layerswapApiKey?: string
  destinationAddress?: string  // L1 Ethereum address to receive funds
  destinationNetwork?: string  // Default: ETHEREUM_MAINNET
}

export interface LayerswapWithdrawParams {
    paradexClient: ParadexClient;
    paradexAction: ParadexAction;
    destinationAddress: string;      
    layerswapApiKey: string;         
    destinationNetwork?: string;   
}

export interface LayerswapSwapResult {
    swapId: string;
    depositAddress: string;
    bridgeCalls: Call[];
}