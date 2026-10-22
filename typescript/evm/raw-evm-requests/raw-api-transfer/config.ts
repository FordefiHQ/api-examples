import dotenv from 'dotenv'

dotenv.config()

export interface FordefiConfig {
  accessToken: string;
  vaultId: string;
  senderAddress: string;
  privateKeyPath: string;
  pathEndpoint: string;
}

export interface TxParams {
  evmChain: string;
  use_secure_node: boolean;
  to: string;
  amount: string;
  gas_limit: string;
  max_fee_per_gas?: string; // only if you're using dynamic gas
  max_priority_fee_per_gas?: string; // only if you're using dynamic gas
}

export const fordefiConfig: FordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  vaultId: process.env.VAULT_ID || "",
  senderAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPath: "./secret/private.pem",
  pathEndpoint: "/api/v1/transactions"
};

export const txParams: TxParams = {
  evmChain: "ethereum",
  use_secure_node: false, // Uses Flashbots RPC, only available on Ethereum mainnet
  to: "0xF659feEE62120Ce669A5C45Eb6616319D552dD93",
  amount: "100000", // in WEI (10^18 WEI = 1 ETH),
  gas_limit: "50000",
  max_fee_per_gas: "1000", // in WEI
  max_priority_fee_per_gas: "500" // in WEI per EIP-1559: max_fee_per_gas >= max_priority_fee_per_gas
};