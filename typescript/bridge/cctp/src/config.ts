import { FordefiProviderConfig } from "@fordefi/web3-provider";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

function getChainId(chainName: string): number {
  switch (chainName) {
    case "Ethereum":
      return 1;
    case "Base":
      return 8453;
    case "Arbitrum":
      return 42161;
    case "Optimism":
      return 10;
    case "Polygon":
      return 137;
    default:
      throw new Error(`Unsupported chain: ${chainName}`);
  }
}

export const bridgeCongfig = {
  chainFrom: "Ethereum",
  chainTo: "Base",
  destinationAddress: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  amount: "1",
};

export const fordefiConfigFrom: FordefiProviderConfig = {
  chainId: getChainId(bridgeCongfig.chainFrom),
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  apiUserToken:
    process.env.FORDEFI_API_USER_TOKEN ??
    (() => {
      throw new Error("FORDEFI_API_USER_TOKEN is not set");
    })(),
  apiPayloadSignKey:
    fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
    (() => {
      throw new Error("PEM_PRIVATE_KEY is not set");
    })(),
  rpcUrl: "https://eth.llamarpc.com",
};

export const fordefiConfigTo: FordefiProviderConfig = {
  chainId: getChainId(bridgeCongfig.chainTo),
  address: bridgeCongfig.destinationAddress as `0x${string}`,
  apiUserToken:
    process.env.FORDEFI_API_USER_TOKEN ??
    (() => {
      throw new Error("FORDEFI_API_USER_TOKEN is not set");
    })(),
  apiPayloadSignKey:
    fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
    (() => {
      throw new Error("PEM_PRIVATE_KEY is not set");
    })(),
  rpcUrl: "https://base.llamarpc.com",
};

//////// EVM TO SOLANA CONFIG ////////////

export interface BridgeConfigSolana {
  // Ethereum side
  ethereumChain: string;
  amountUsdc: string; // Human-readable amount (e.g., "10.5")
  useFastTransfer: boolean; // Use fast transfer (20 seconds, 0.01% fee) vs standard (13-19 minutes, free)

  // Solana side
  solanaRpcUrl: string;
  solanaChain: "solana_mainnet" | "solana_devnet";
  solanaRecipientAddress: string; // Solana wallet address that will receive USDC
  fordefiVaultId: string; // Fordefi vault ID for Solana signer
  apiUserToken: string,
  apiPayloadSignKey: any
}

export const bridgeConfigSolana: BridgeConfigSolana = {
  ethereumChain: "Ethereum",
  amountUsdc: "0.1",
  useFastTransfer: true, // Set to false for standard transfer (free but takes 13-19 minutes)
  solanaRpcUrl: "https://api.mainnet-beta.solana.com",
  solanaChain: "solana_mainnet",
  solanaRecipientAddress: "CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim",
  fordefiVaultId: "9597e08a-32a8-4f96-a043-a3e7f1675f8d",
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN ??
    (() => {
      throw new Error("FORDEFI_API_USER_TOKEN is not set");
    })(),
  apiPayloadSignKey:
    fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
    (() => {
      throw new Error("PEM_PRIVATE_KEY is not set");
    })(),
};
