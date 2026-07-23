import dotenv from "dotenv";
import { readSharedPrivateKey } from "../../fordefi/key-loader.js";
import { PaymentConfig, TokenPaymentConfig } from './interfaces.js';
import { FordefiStellarConfig, PushMode, StellarChain } from "../../fordefi/interfaces.js";

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

export const paymentConfig: PaymentConfig = {
  vaultAddress: requireEnv("STELLAR_VAULT_ADDRESS"),
  destination: requireEnv("STELLAR_DESTINATION"),
  amount: requireEnv("STELLAR_AMOUNT"),
  horizonUrl: process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org",
};


// Classic-asset payment (used by `npm run raw-payment-token`), e.g. GYEN, a
// JPY-pegged stablecoin: https://stellar.expert/explorer/public/asset/GYEN-GDF6VOEGRWLOZ64PQQGKD2IYWA22RLT37GJKS2EJXZHT2VLAGWLC5TOB
export const tokenPaymentConfig: TokenPaymentConfig = {
  vaultAddress: requireEnv("STELLAR_VAULT_ADDRESS"),
  destination: requireEnv("STELLAR_DESTINATION"),
  amount: requireEnv("STELLAR_AMOUNT"),
  horizonUrl: process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org",
  assetCode: process.env.STELLAR_ASSET_CODE!,
  assetIssuer: process.env.STELLAR_ASSET_ISSUER!,
  memoId: process.env.STELLAR_MEMO_ID,
};
