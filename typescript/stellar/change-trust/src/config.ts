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

export interface TrustlineConfig {
  assetCode: string;
  assetIssuer: string;
}

export const trustlineConfig: TrustlineConfig = {
  assetCode: requireEnv("STELLAR_ASSET_CODE"),
  assetIssuer: requireEnv("STELLAR_ASSET_ISSUER"),
};
