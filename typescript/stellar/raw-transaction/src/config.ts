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

export interface PaymentConfig {
  vaultAddress: string;
  destination: string;
  amount: string;
  horizonUrl: string;
}

export const paymentConfig: PaymentConfig = {
  vaultAddress: requireEnv("STELLAR_VAULT_ADDRESS"),
  destination: requireEnv("STELLAR_DESTINATION"),
  amount: requireEnv("STELLAR_AMOUNT"),
  horizonUrl: process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org",
};
