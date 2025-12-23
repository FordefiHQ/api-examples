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
  to: string;
  amount: string;
  gas_limit: string;
  max_fee_per_gas?: string; // only if you're using dynamic gas
  max_priority_fee_per_gas?: string; // only if you're using dynamic gas
  hex_call_data?: string
  custom_nonce?: string
}

export const fordefiConfig: FordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  vaultId: process.env.FORDEFI_EVM_VAULT_ID || "",
  senderAddress: process.env.FORDEFI_EVM_VAULT_ADDRESS || "",
  privateKeyPath: "./fordefi_secret/private.pem",
  pathEndpoint: "/api/v1/transactions"
}

export const txParams: TxParams = {
  evmChain: "31337", // use chainID
  to: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // contract or destination address
  amount: "0", // in WEI (10^18 WEI = 1 ETH),
  gas_limit: "50000",
  max_fee_per_gas: "514164549", // in WEI
  max_priority_fee_per_gas: "514164549", // in WEI per EIP-1559: max_fee_per_gas >= max_priority_fee_per_gas
  // custom_nonce: "0" // Use only to fix nonce issues on Hardhat
};

export const contractAbi = [
  "function inc()",
  // Add more function signatures as needed
];