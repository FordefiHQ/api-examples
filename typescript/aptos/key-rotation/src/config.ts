import { Network } from "@aptos-labs/ts-sdk";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

export interface FordefiConfig {
  accessToken: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
}

export interface RotationConfig {
  /** Fordefi vault ID that will become the new auth key owner */
  fordefiVaultId: string;
  /** Fordefi vault's Aptos address (the new public key holder) */
  fordefiVaultAddress: string;
  /** Deployer account address whose auth key we are rotating */
  deployerAddress: `0x${string}`;
  /** Deployer's Ed25519 private key (hex, no 0x prefix) */
  deployerPrivateKeyHex: string;
}

export const fordefiConfig: FordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN!,
  privateKeyPem: fs.readFileSync("./secret/private.pem", "utf8"),
  apiPathEndpoint: "/api/v1/transactions",
};

export const rotationConfig: RotationConfig = {
  fordefiVaultId: process.env.FORDEFI_VAULT_ID!,
  fordefiVaultAddress: process.env.FORDEFI_VAULT_ADDRESS!,
  deployerAddress: process.env.DEPLOYER_ADDRESS! as `0x${string}`,
  deployerPrivateKeyHex: process.env.DEPLOYER_PRIVATE_KEY_HEX!,
};

export const APTOS_NETWORK =
  (process.env.APTOS_NETWORK as Network) ?? Network.MAINNET;
