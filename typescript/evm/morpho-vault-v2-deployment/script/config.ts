import fs from "fs";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config();

export const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ??
  (() => { throw new Error("FORDEFI_API_USER_TOKEN is not set"); })();
export const PEM_PRIVATE_KEY = fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
  (() => { throw new Error("PEM_PRIVATE_KEY is not set"); })();
export const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ??
  (() => { throw new Error("FORDEFI_EVM_VAULT_ADDRESS is not set"); })();
export const RPC_URL = process.env.RPC_URL ??
  (() => { throw new Error("RPC_URL is not set"); })();

export const config: FordefiProviderConfig = {
  chainId: 8453, // Base
  address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: RPC_URL,
  skipPrediction: false
};

// VaultV2 deployment configuration (all roles default to Fordefi vault address)
export const OWNER = process.env.OWNER ?? FORDEFI_EVM_VAULT_ADDRESS;
export const CURATOR = process.env.CURATOR ?? FORDEFI_EVM_VAULT_ADDRESS;
export const ALLOCATOR = process.env.ALLOCATOR ?? FORDEFI_EVM_VAULT_ADDRESS;
export const SENTINEL = process.env.SENTINEL ?? ethers.ZeroAddress;
export const VAULT_V1 = process.env.VAULT_V1 ??
  (() => { throw new Error("VAULT_V1 is not set"); })();
export const ADAPTER_REGISTRY = process.env.ADAPTER_REGISTRY ??
  (() => { throw new Error("ADAPTER_REGISTRY is not set"); })();
export const VAULT_V2_FACTORY = process.env.VAULT_V2_FACTORY ??
  (() => { throw new Error("VAULT_V2_FACTORY is not set"); })();
export const MORPHO_VAULT_V1_ADAPTER_FACTORY = process.env.MORPHO_VAULT_V1_ADAPTER_FACTORY ??
  (() => { throw new Error("MORPHO_VAULT_V1_ADAPTER_FACTORY is not set"); })();
export const TIMELOCK_DURATION = process.env.TIMELOCK_DURATION ? parseInt(process.env.TIMELOCK_DURATION) : 0;
// Dead deposit for inflation attack protection
// Default: 1 USDC (1e6) - adjust for different token decimals if using non-USDC VaultV1
// Set to 0 to skip dead deposit (not recommended for public vaults)
export const DEAD_DEPOSIT_AMOUNT = process.env.DEAD_DEPOSIT_AMOUNT !== undefined
  ? BigInt(process.env.DEAD_DEPOSIT_AMOUNT)
  : 1_000_000n; // 1 USDC (6 decimals) - change if using different underlying asset