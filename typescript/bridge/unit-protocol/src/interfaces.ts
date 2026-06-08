export interface Proposal {
  destinationAddress: string;
  destinationChain: string;
  asset: string;
  address: string;
  sourceChain: string;
  coinType?: string;
  keyType?: string;
}

export interface VerificationResult {
  success: boolean;
  verifiedCount: number;
  errors?: string[];
  verificationDetails?: { [nodeId: string]: boolean };
}

export interface DepositAddressResponse {
  address: string;
  signatures: { [nodeId: string]: string };
  status: string;
}

export interface FordefiApiConfig {
    vaultId: string;
    hyperliquid_address: string,
    address: string;
    accessToken: string;
    privateKeyPath: string;
    pathEndpoint: string;
    chain: "bitcoin_mainnet" | "bitcoin_testnet_v4",
    pushMode: "auto";
    transferAmount: string;
}  