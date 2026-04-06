import fs from "fs";
import dotenv from "dotenv";
import { FordefiStarknetConfig, PushMode, StarknetChain } from "./fordefi/interfaces.js";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function readPrivateKeyFile(): string {
  return fs.readFileSync("./secret/private.pem", "utf8");
}

export const FORDEFI_API_BASE_URL = "https://api.fordefi.com";
export const TRANSACTIONS_API_PATH = "/api/v1/transactions";

export const fordefiConfig: FordefiStarknetConfig = {
  accessToken: requireEnv("FORDEFI_API_USER_TOKEN"),
  apiPayloadSignKey: readPrivateKeyFile(),
  vaultId: requireEnv("FORDEFI_STARKNET_VAULT_ID"),
  chain: (process.env.STARKNET_CHAIN || "starknet_mainnet") as StarknetChain,
  pushMode: "auto" as PushMode,
};

export interface ContractCallConfig {
  contractAddress: string;
  methodName: string;
  methodArguments: string[]
}

export const contractCallConfig: ContractCallConfig = {
  contractAddress: "0x...",
  methodName: "register_operator",
  methodArguments: ["0x5e0cce9382de6b18051f014f9078df73af85bcddb7ef158743cca7c484f5997"],
};
