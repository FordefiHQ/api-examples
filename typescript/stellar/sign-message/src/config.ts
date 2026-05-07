import dotenv from "dotenv";
import { FordefiStellarConfig, PushMode, StellarChain } from "../../fordefi/interfaces.js";
import { readSharedPrivateKey } from "../../fordefi/key-loader.js";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const fordefiConfig: FordefiStellarConfig = {
  accessToken: requireEnv("FORDEFI_API_USER_TOKEN"),
  apiPayloadSignKey: readSharedPrivateKey(),
  vaultId: requireEnv("FORDEFI_STELLAR_VAULT_ID"),
  chain: "stellar_mainnet" as StellarChain,
  pushMode: "auto" as PushMode,
};

export interface MessageConfig {
  message?: string;
  messageHex?: string;
}

export const messageConfig: MessageConfig = {
  message: "Hello from Fordefi!",
  messageHex: process.env.STELLAR_MESSAGE_HEX
};
