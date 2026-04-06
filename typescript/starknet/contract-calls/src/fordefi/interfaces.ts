export type SignerType = "initiator" | "api_signer";
export type StarknetChain = "starknet_mainnet" | "starknet_sepolia";
export type PushMode = "auto" | "manual" | "deferred";

export interface FordefiStarknetConfig {
  accessToken: string;
  apiPayloadSignKey: string;
  vaultId: string;
  chain: StarknetChain;
  pushMode: string, 
}

export interface StarknetCallData {
  to: string;
  method_name: string;
  method_arguments: string[];
}

export interface StarknetContractCallDetails {
  type: "starknet_contract_call";
  chain: StarknetChain;
  push_mode: PushMode;
  call_data: StarknetCallData[];
}

export interface CreateStarknetTransactionRequest {
  vault_id: string;
  signer_type: SignerType;
  type: "starknet_transaction";
  details: StarknetContractCallDetails;
  note?: string;
}

export type TransactionState =
  | "pending_signature"
  | "signed"
  | "pushed_to_blockchain"
  | "mined"
  | "completed"
  | "failed"
  | "aborted";

export interface StarknetTransactionResponse {
  id: string;
  state: TransactionState;
  starknet_transaction?: {
    hash?: string;
  };
  error?: string;
}
