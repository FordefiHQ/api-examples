import { FordefiProviderConfig } from "@fordefi/web3-provider";
import { PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

//////// EVM TO EVM CONFIG ////////////
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
  chainFrom: "Arbitrum",
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
  rpcUrl: "https://arb1.arbitrum.io/rpc",
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
  amountUsdc: string; // Human-readable amount (--> "10.5")
  useFastTransfer: boolean; // Use fast transfer (20 seconds, 0.01% fee) vs standard (13-19 minutes, free)
  // Solana side
  solanaRpcUrl: string;
  solanaRecipientAddress: string; // Solana wallet address that will receive USDC
  evmRecipientAddress: string; // EVM wallet address that will receive USDC when bridging from Solana to EVM
  fordefiVaultId: string; // Fordefi vault ID for Solana signer
  apiUserToken: string,
  apiPayloadSignKey: any
}

export const bridgeConfigSolana: BridgeConfigSolana = {
  ethereumChain: bridgeCongfig.chainFrom,
  amountUsdc: "0.1",
  useFastTransfer: true, // Set to false for standard transfer (free but takes 13-19 minutes)
  solanaRpcUrl: "https://api.mainnet-beta.solana.com",
  solanaRecipientAddress: "CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim",
  evmRecipientAddress: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73", // EVM address for Solana->EVM bridge
  fordefiVaultId: "9597e08a-32a8-4f96-a043-a3e7f1675f8d",
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN ??
    (() => {
      throw new Error("FORDEFI_API_USER_TOKEN is not set");
    })(),
  apiPayloadSignKey:
    fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
    (() => {
      throw new Error("PEM_PRIVATE_KEY is not set");
    })()
};

// CCTP & USDC Contracts
// V2 TokenMessenger with Fast Transfer support
export const TOKEN_MESSENGER = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
export const ETHEREUM_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
// V2 MessageTransmitter addresses
export const ARBITRUM_MESSAGE_TRANSMITTER_V2 = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";
// Solana CCTP Program IDs (Mainnet & Devnet)
export const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
);
export const TOKEN_MESSENGER_MINTER_PROGRAM_ID = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
);
export const SOLANA_USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
// CCTP Domain IDs
export const ETHEREUM_DOMAIN = 0;
export const ARBITRUM_DOMAIN = 3;
export const SOLANA_DOMAIN = 5;
export const SOLANA_RELAYER_PRIVATE_KEY = process.env.PHANTOM_PK || "";
