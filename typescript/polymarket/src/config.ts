import fs from "fs";
import dotenv from "dotenv";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config();

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ??
  (() => { throw new Error("FORDEFI_API_USER_TOKEN is not set"); })();
const PEM_PRIVATE_KEY = fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
  (() => { throw new Error("PEM_PRIVATE_KEY is not set"); })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ??
  (() => { throw new Error("FORDEFI_EVM_VAULT_ADDRESS is not set"); })();
const RPC_URL = process.env.RPC_URL ??
  (() => { throw new Error("RPC_URL is not set"); })();

export const fordefiConfig: FordefiProviderConfig = {
  chainId: 137, // Polygon
  address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: RPC_URL,
  skipPrediction: false
};


// CLOB API credentials are deterministic per wallet, so they are cached on
// disk after the first derivation — repeat runs then need zero ClobAuth
// signatures from the vault. The cache lives next to the API signer key in
// the gitignored fordefi_secret/ directory.
export const CREDS_CACHE_PATH = "./fordefi_secret/clob-creds.json";

// Relayer credentials are validated lazily at first use instead of at
// import time, so config loading never depends on them.

export const HOST = "https://clob.polymarket.com";
export const RELAYER_HOST = "https://relayer-v2.polymarket.com";

export function getRelayerAuth() {
  const apiKey = process.env.RELAYER_API_KEY ??
    (() => { throw new Error("RELAYER_API_KEY is not set (create one on polymarket.com → Settings → API Keys)"); })();
  const apiKeyAddress = process.env.RELAYER_API_KEY_ADDRESS ??
    (() => { throw new Error("RELAYER_API_KEY_ADDRESS is not set (the address the relayer API key was created with)"); })();
  return { apiKey, apiKeyAddress };
}