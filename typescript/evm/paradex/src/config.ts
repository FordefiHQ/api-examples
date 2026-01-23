import fs from "fs";
import dotenv from "dotenv";
import { ParadexAction, OrderDetails } from "./interfaces.js";
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
export const PARADEX_API_URL = "https://api.prod.paradex.trade/v1";
export const PARADEX_CHAIN_ID = "PRIVATE_SN_PARACLEAR_MAINNET";

// Example order configuration (used when action is "place-order")
export const orderDetails: OrderDetails = {
  market: "ETH-USD-PERP",
  side: "BUY",
  type: "LIMIT",
  size: "0.0001", // minimum is 0.0001
  price: "2000"
};

export const paradexAction: ParadexAction = {
  action: "onboard", //  "balance" | "withdraw-layerswap" | "place-order" | "account-status" | "cancel-orders" | "onboard"
  amountToWithdraw: "0.5",
  // Layerswap options (only used when action is "withdraw-layerswap")
  layerswapApiKey: LAYERSWAP_API_KEY,
  destinationAddress: FORDEFI_EVM_VAULT_ADDRESS,
  destinationNetwork: "ETHEREUM_MAINNET",
  // Trading options (only used when action is "place-order")
  orderDetails: orderDetails
}; 