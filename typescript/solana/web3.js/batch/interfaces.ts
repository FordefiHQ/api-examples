import { PublicKey } from "@solana/web3.js";

export interface FordefiSolanaConfig {
    accessToken: string;
    vaultId: string;
    fordefiSolanaVaultAddress: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
};
  
  export interface BatchConfig {
    fordefiVault: PublicKey;
    recipientsList: PublicKey[];
    amountPerRecipient: bigint;
    tableAddress: PublicKey;
    action: "create" | "extend" | "batch";
    isSplBatch: boolean
};