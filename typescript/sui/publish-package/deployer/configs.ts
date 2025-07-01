import dotenv from 'dotenv';

dotenv.config();

export interface FordefiSolanaConfig {
  accessToken: string;
  privateKeyPath: string;
  vaultId: string;
  senderAddress: string
};

export const fordefiConfig: FordefiSolanaConfig = {
    accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
    privateKeyPath: "./fordefi_secret/private.pem",
    vaultId: process.env.VAULT_ID || "",
    senderAddress:process.env.VAULT_ADDRESS || ""
};

export const suiNetwork = "https://fullnode.mainnet.sui.io:443"

export const compiledModulesandDependencies = '../compiled-sui-package/example-package.json'