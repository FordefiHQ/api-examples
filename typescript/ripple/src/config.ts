import dotenv from "dotenv";
import {
  FordefiRippleConfig,
  PushMode,
  RippleChainUniqueId,
} from "../fordefi/interfaces.js";
import { readSharedPrivateKey } from "../fordefi/key-loader.js";

dotenv.config();

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const SUPPORTED_CHAINS: RippleChainUniqueId[] = ["ripple_mainnet", "ripple_testnet"];

function readChain(): RippleChainUniqueId {
  const value = (process.env.NETWORK ?? "ripple_testnet") as RippleChainUniqueId;
  if (!SUPPORTED_CHAINS.includes(value)) {
    throw new Error(`NETWORK must be one of: ${SUPPORTED_CHAINS.join(", ")}`);
  }
  return value;
}

export const fordefiConfig: FordefiRippleConfig = {
  accessToken: requireEnv("FORDEFI_API_USER_TOKEN"),
  apiPayloadSignKey: readSharedPrivateKey(),
  vaultId: requireEnv("FORDEFI_RIPPLE_VAULT_ID"),
  chain: readChain(),
  pushMode: "auto" as PushMode,
};

/** Native XRP transfer (`npm run transfer:xrp`). */
export const xrpTransferConfig = {
  /**
   * Amount in **drops**, the native asset's base unit (6 decimals, so
   * 1 XRP = "1000000"), passed to the API unscaled.
   */
  amountDrops: requireEnv("RIPPLE_XRP_AMOUNT"),
  recipientAddress: requireEnv("RIPPLE_RECIPIENT_ADDRESS"),
  /** Optional XRPL destination tag — required by most exchanges. */
  destinationTag: process.env.RIPPLE_DESTINATION_TAG,
};

/** Issued-token (IOU) transfer and trust line (`npm run transfer:token`, `npm run trustline`). */
export const tokenConfig = {
  /** 3-char currency code (e.g. USD) or 40-char hex code. */
  currency: requireEnv("RIPPLE_CURRENCY"),
  issuerAddress: requireEnv("RIPPLE_ISSUER_ADDRESS"),
};

/**
 * Amount for the IOU transfer, in the asset's **base units** — the same integer
 * the API's `value` field takes, passed through unscaled. XRPL trust-line assets
 * have 15 decimals, so 1 USDC is "1000000000000000" and "1" is 10^-15 USDC.
 * Convert from display amounts in your own code if you need to.
 */
export const tokenTransferAmount = (): string => requireEnv("RIPPLE_TOKEN_AMOUNT");

/** Recipient for the IOU transfer; falls back to the native transfer recipient. */
export const tokenRecipientAddress = (): string =>
  process.env.RIPPLE_TOKEN_RECIPIENT_ADDRESS ?? requireEnv("RIPPLE_RECIPIENT_ADDRESS");

/** Source CheckCreate transaction for `npm run check:cash`; auto-discovered when unset. */
export const checkSourceTransactionId: string | undefined =
  process.env.RIPPLE_CHECK_SOURCE_TX_ID;
