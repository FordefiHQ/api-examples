export type SignerType = "initiator" | "api_signer";
export type SignMode = "auto" | "triggered";
export type PushMode = "auto" | "manual" | "deferred";
export type StellarChain = "stellar_mainnet";

export interface FordefiStellarConfig {
  accessToken: string;
  apiPayloadSignKey: string;
  vaultId: string;
  chain: StellarChain;
  pushMode: PushMode;
}

export interface StellarNativeAssetIdentifier {
  type: "stellar";
  details: {
    type: "native";
    chain: StellarChain;
  };
}

export interface StellarAddress {
  chain: StellarChain;
  base32_repr: string;
}

export interface StellarClassicAssetIdentifier {
  type: "stellar";
  details: {
    type: "classic_asset";
    chain: StellarChain;
    code: string;
    issuer: StellarAddress;
  };
}

export type StellarAssetIdentifier =
  | StellarNativeAssetIdentifier
  | StellarClassicAssetIdentifier;

export interface StellarChangeTrustDetails {
  type: "stellar_change_trust";
  asset_identifier: StellarClassicAssetIdentifier;
  push_mode?: PushMode;
}

export type ClaimClaimableBalanceSource =
  | { type: "by_asset"; asset_identifier: StellarAssetIdentifier }
  | { type: "by_transaction"; transaction_id: string };

export interface StellarClaimClaimableBalanceDetails {
  type: "stellar_claim_claimable_balance";
  source: ClaimClaimableBalanceSource;
  push_mode?: PushMode;
}

export interface StellarRawTransactionDetails {
  type: "stellar_raw_transaction";
  chain: StellarChain;
  xdr_data: string;
  push_mode?: PushMode;
}

export type StellarTransactionDetails =
  | StellarChangeTrustDetails
  | StellarClaimClaimableBalanceDetails
  | StellarRawTransactionDetails;

export interface CreateStellarTransactionRequest {
  vault_id: string;
  signer_type: SignerType;
  type: "stellar_transaction";
  details: StellarTransactionDetails;
  note?: string;
}

export interface StellarMessageRequestDetails {
  chain: StellarChain;
  raw_data: string;
}

export interface CreateStellarMessageRequest {
  vault_id: string;
  signer_type: SignerType;
  sign_mode?: SignMode;
  type: "stellar_message";
  details: StellarMessageRequestDetails;
  note?: string;
}

export type CreateStellarRequest =
  | CreateStellarTransactionRequest
  | CreateStellarMessageRequest;

export type TransactionState =
  | "pending_signature"
  | "signed"
  | "pushed_to_blockchain"
  | "mined"
  | "completed"
  | "failed"
  | "aborted";

export interface StellarSignature {
  data: string;
}

export interface StellarTransactionResponse {
  id: string;
  state: TransactionState;
  hash?: string;
  explorer_url?: string;
  signatures?: StellarSignature[];
  raw_data?: string;
  error?: string;
}
