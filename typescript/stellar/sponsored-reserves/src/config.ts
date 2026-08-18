import dotenv from "dotenv";
import { Asset, Keypair, StrKey } from "@stellar/stellar-sdk";
import { PushMode, StellarChain } from "../../fordefi/interfaces.js";
import { readSharedPrivateKey } from "../../fordefi/key-loader.js";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function parseTimeout(): number {
  const raw = process.env.STELLAR_TX_TIMEOUT_SECS;
  if (!raw) return 3600;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`STELLAR_TX_TIMEOUT_SECS must be a non-negative integer, got: ${raw}`);
  }
  return parsed;
}

function loadSponsoredSecret(): string {
  const secret = requireEnv("SPONSORED_ED25519_SECRET");
  if (!StrKey.isValidEd25519SecretSeed(secret)) {
    throw new Error("SPONSORED_ED25519_SECRET is not a valid Stellar ed25519 secret seed (S...)");
  }
  return secret;
}

function loadAsset(): Asset {
  const code = requireEnv("STELLAR_ASSET_CODE");
  const issuer = requireEnv("STELLAR_ASSET_ISSUER");
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error("STELLAR_ASSET_ISSUER is not a valid ed25519 public key (G...)");
  }
  // Asset() enforces the code's length/charset rules for us.
  return new Asset(code, issuer);
}

export interface FordefiSponsorConfig {
  accessToken: string;
  apiPayloadSignKey: string;
  vaultId: string;
  chain: StellarChain;
  pushMode: PushMode;
}

export interface SponsoredReservesConfig {
  vaultAddress: string;
  sponsoredSecret: string;
  sponsoredPubkey: string;
  asset: Asset;
  horizonUrl: string;
  explorerBaseUrl: string;
  txTimeoutSecs: number;
}

export const fordefiConfig: FordefiSponsorConfig = {
  accessToken: requireEnv("FORDEFI_API_USER_TOKEN"),
  apiPayloadSignKey: readSharedPrivateKey(),
  vaultId: requireEnv("FORDEFI_STELLAR_VAULT_ID"),
  chain: "stellar_mainnet" as StellarChain,
  // The vault signs but does NOT broadcast. The envelope is still missing the
  // sponsored account's EndSponsoringFutureReserves signature at that point, so
  // Fordefi must hand it back to us — we attach the second signature locally and
  // submit to Horizon ourselves.
  pushMode: "manual" as PushMode,
};

const sponsoredSecret = loadSponsoredSecret();
const sponsoredPubkey = Keypair.fromSecret(sponsoredSecret).publicKey();
const vaultAddress = requireEnv("STELLAR_VAULT_ADDRESS");

if (!StrKey.isValidEd25519PublicKey(vaultAddress)) {
  throw new Error("STELLAR_VAULT_ADDRESS is not a valid ed25519 public key (G...)");
}
if (vaultAddress === sponsoredPubkey) {
  throw new Error(
    "STELLAR_VAULT_ADDRESS and the account derived from SPONSORED_ED25519_SECRET are the same. " +
      "An account cannot sponsor itself — generate a fresh keypair with `npm run gen-keypair`."
  );
}

export const sponsoredReservesConfig: SponsoredReservesConfig = {
  vaultAddress,
  sponsoredSecret,
  sponsoredPubkey,
  asset: loadAsset(),
  horizonUrl: process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org",
  explorerBaseUrl: process.env.STELLAR_EXPLORER_URL || "https://stellar.expert/explorer/public",
  txTimeoutSecs: parseTimeout(),
};
