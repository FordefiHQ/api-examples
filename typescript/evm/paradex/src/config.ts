import fs from "fs";
import dotenv from "dotenv";
import { ParadexAction } from "./interfaces.js";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config();

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ??
  (() => { throw new Error("FORDEFI_API_USER_TOKEN is not set"); })();
const PEM_PRIVATE_KEY = fs.readFileSync("./secret/private.pem", "utf8") ??
  (() => { throw new Error("PEM_PRIVATE_KEY is not set"); })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ??
  (() => { throw new Error("FORDEFI_EVM_VAULT_ADDRESS is not set"); })();
 const LAYERSWAP_API_KEY = process.env.LAYERSWAP_API_KEY ??
 (() => { throw new Error("LAYERSWAP_API_KEY is not set"); })();

export const fordefiConfig: FordefiProviderConfig = {
  chainId: 1, 
  address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: "https://eth.llamarpc.com",
  skipPrediction: false
};

export const LAYERSWAP_API_URL = "https://api.layerswap.io/api/v2";

export const paradexAction: ParadexAction = {
  action: "withdraw-layerswap",
  amountToWithdraw: "0.5",
  // Layerswap options (only used when action is "withdraw-layerswap")
  layerswapApiKey: LAYERSWAP_API_KEY,
  destinationAddress: FORDEFI_EVM_VAULT_ADDRESS,
  destinationNetwork: "ETHEREUM_MAINNET"
}; 