import { Address, checksumAddress } from "viem";
import { FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config()

export interface MintOrder {
  amount: number;
  collateralAsset: "USDT" | "USDC";
  benefactor: Address;
  side: "MINT" | "REDEEM";
  allowInfiniteApprovals: boolean;
  collateralAddresses: {
    USDC: Address;
    USDT: Address;
  };
}

export const fordefiConfig: FordefiProviderConfig = {
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN  || "",
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8'),
  chainId: 1, // Mainnet
  rpcUrl: "https://eth.llamarpc.com",
  skipPrediction: true
};

export const mintOrder: MintOrder = {
  amount: 10000,
  collateralAsset: "USDC",
  benefactor: checksumAddress(
    fordefiConfig.address
  ) as Address,
  side: "MINT", // or "REDEEM"
  allowInfiniteApprovals: false,
  collateralAddresses: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // mainnet
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7"  // mainnet
  }
};