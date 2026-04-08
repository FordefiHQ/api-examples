import { ethers } from "ethers";

/**
 * Configure which batch operation to run and its parameters.
 * Edit this file before running `npm run client`.
 */

export type BatchMode =
  | "batchSendETHSameAmount"
  | "batchSendETHDifferentAmounts"
  | "batchSendTokenSameAmount"
  | "batchSendTokenDifferentAmounts";

export interface BatchConfig {
  mode: BatchMode;
  recipients: string[];
  /** Used for "same amount" modes */
  amountPerRecipient?: string;
  /** Used for "different amounts" modes — must match recipients length */
  amounts?: string[];
  /** ERC20 token address — required for token modes */
  tokenAddress?: string;
}

export const batchConfig: BatchConfig = {
  mode: "batchSendTokenSameAmount",
  recipients: [ // change to your recipients!
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
  ],
  // For "same amount" modes
  // amountPerRecipient: ethers.parseEther("0.01").toString(), // value in ETH
  amountPerRecipient: "10", // value in token decimals for ERC20
  // For "different amounts" modes — one entry per recipient
  // amounts: [
  //   ethers.parseEther("0.001").toString(),
  //   ethers.parseEther("0.002").toString(),
  // ],
  // For token modes — the ERC20 contract address
  tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // e.g. USDC
};
