import { PricedAsset } from "./interfaces.js";

/**
 * Renders a base-unit integer as a decimal token amount, for display only — no
 * recipe converts an amount on the way in. Kept as string math so a 15-decimal
 * IOU never touches a float.
 */
export function fromBaseUnits(baseUnits: string, decimals: number): string {
  if (decimals === 0) return baseUnits;
  const negative = baseUnits.startsWith("-");
  const digits = negative ? baseUnits.slice(1) : baseUnits;
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Every amount the API returns — `amount`, `diff`, `fee_charged`, `limit` — is a
 * base-unit integer, so that figure leads and the decimal amount follows in
 * parentheses as a reading aid: the number shown first is the one the API takes
 * and returns. The symbol and decimals sit under `priced_asset.asset_info`;
 * reading `priced_asset.symbol` yields undefined.
 */
export function formatAmount(baseUnits: string, asset: PricedAsset | undefined): string {
  const info = asset?.asset_info;
  if (typeof info?.decimals !== "number") {
    return info?.symbol ? `${baseUnits} ${info.symbol}` : baseUnits;
  }
  const scaled = fromBaseUnits(baseUnits, info.decimals);
  return `${baseUnits} (${scaled}${info.symbol ? ` ${info.symbol}` : ""})`;
}

/**
 * `ripple_create_trustline` always opens the line at XRPL's maximum limit, which
 * is a ~110-digit base-unit integer. Printing it in full tells the reader nothing
 * that "maximum" does not.
 */
export function formatLimit(limit: string, asset: PricedAsset | undefined): string {
  const symbol = asset?.asset_info?.symbol;
  if (limit.replace(/^-/, "").length > 30) {
    return symbol ? `maximum ${symbol}` : "maximum";
  }
  return formatAmount(limit, asset);
}
