import { Call } from "starknet";
import { ParadexClient } from "@paradex/sdk";

export interface OrderDetails {
  market: string;           // e.g., "ETH-USD-PERP"
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  size: string;             // e.g., "0.01"
  price?: string;           // Required for LIMIT orders
}

export interface ParadexAction {
  action: "balance" | "withdraw-layerswap" | "place-order" | "account-status" | "cancel-orders" | "onboard"
  amountToWithdraw: string
  // Layerswap config (required for withdraw-layerswap)
  layerswapApiKey?: string
  destinationAddress?: string  // L1 Ethereum address to receive funds
  destinationNetwork?: string  // Default: ETHEREUM_MAINNET
  // Trading config (required for place-order)
  orderDetails?: OrderDetails
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