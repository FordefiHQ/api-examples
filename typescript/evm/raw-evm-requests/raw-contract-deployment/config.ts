import dotenv from 'dotenv'

dotenv.config()

export interface FordefiConfig {
  accessToken: string;
  vaultId: string;
  senderAddress: string;
  privateKeyPath: string;
  pathEndpoint: string;
}

export interface DeployParams {
  evmChain: string;
  artifactPath: string;
  custom_nonce: string;
  gas_limit: string;
  max_fee_per_gas: string;
  max_priority_fee_per_gas: string;
}

export const fordefiConfig: FordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  vaultId: process.env.VAULT_ID || "",
  senderAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPath: "./secret/private.pem",
  pathEndpoint: "/api/v1/transactions"
};

export const deployParams: DeployParams = {
  evmChain: "ethereum",
  artifactPath: "./out/Counter.sol/Counter.json", // produced by `forge build`
  custom_nonce: process.env.CUSTOM_NONCE || "", // must be the vault's next nonce, or the nonce of a signed-but-unmined tx you want to replace
  gas_limit: "300000",
  max_fee_per_gas: "1000", // in WEI
  max_priority_fee_per_gas: "500" // in WEI per EIP-1559: max_fee_per_gas >= max_priority_fee_per_gas
};
