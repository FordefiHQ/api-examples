// Types transcribed from the Fordefi OpenAPI spec (schemas: CreateRippleTransactionRequest,
// CreateRippleTransferRequest, CreateRippleTrustlineRequest, CreateRippleCashCheckRequest,
// TransactionPredictRippleTransactionRequest, RippleTransaction).

export type SignerType =
  | "initiator"
  | "api_signer"
  | "end_user"
  | "multiple_signers"
  | "api_user";
export type SignMode = "auto" | "triggered";
export type PushMode = "auto" | "manual" | "deferred";
export type RippleChainUniqueId = "ripple_mainnet" | "ripple_testnet";

export interface FordefiRippleConfig {
  accessToken: string;
  apiPayloadSignKey: string;
  vaultId: string;
  chain: RippleChainUniqueId;
  pushMode: PushMode;
}

// --- Asset identifiers -------------------------------------------------------

export interface RippleAddressRequest {
  /** Classic (base58check) representation of the address, e.g. `rHb9...`. */
  base58_repr: string;
  chain: RippleChainUniqueId;
}

export interface RippleNativeAssetIdentifierRequest {
  type: "native";
  chain: RippleChainUniqueId;
}

export interface RippleTrustLineAssetIdentifierRequest {
  type: "trust_line_asset";
  /** 3-char currency code (e.g. `USD`) or 40-char hex code. */
  currency: string;
  issuer: RippleAddressRequest;
}

export interface RippleAssetIdentifierRequest {
  type: "ripple";
  details:
    | RippleNativeAssetIdentifierRequest
    | RippleTrustLineAssetIdentifierRequest;
}

export interface RippleNativeAssetIdentifier extends RippleAssetIdentifierRequest {
  details: RippleNativeAssetIdentifierRequest;
}

export interface RippleTrustLineAssetIdentifier extends RippleAssetIdentifierRequest {
  details: RippleTrustLineAssetIdentifierRequest;
}

// --- Recipients and amounts --------------------------------------------------

/** The XRPL recipient variants. Note there is no contact-id variant for Ripple. */
export type RippleRecipient =
  | { type: "address"; address: string }
  | { type: "vault_id"; vault_id: string };

export type CreateRequestAmount =
  | { type: "value"; value: string }
  | { type: "max" };

// --- Transaction details ----------------------------------------------------

/** Options shared by all three Ripple detail types. */
interface RippleDetailsCommon {
  push_mode?: PushMode;
  skip_prediction?: boolean;
  fail_on_prediction_failure?: boolean;
}

export interface CreateRippleTransferRequest extends RippleDetailsCommon {
  type: "ripple_transfer";
  asset_identifier: RippleAssetIdentifierRequest;
  to: RippleRecipient;
  /**
   * Always an integer count of the asset's **base units**, never a decimal token
   * amount: 10^-decimals of one token. Native XRP is drops (decimals 6, so 1 XRP
   * = "1000000"); XRPL trust-line assets are decimals 15, so 1 USDC is
   * "1000000000000000" and "1" is 0.000000000000001 USDC. Read `decimals` off
   * `asset_info` (`GET /vaults/{id}/assets`) rather than assuming.
   */
  value: CreateRequestAmount;
  /** Optional XRPL destination tag, as a numeric string. */
  tag?: string;
}

/**
 * A TrustSet that opens a trust line for an issued token (IOU) at the maximum
 * possible limit. The API exposes no limit field.
 *
 * `asset_identifier` is narrowed to the trust-line variant on purpose: the spec
 * types it as the full union and the API accepts a `native` identifier here at
 * the schema level, but a trust line for native XRP is meaningless. Narrowing
 * turns that into a compile error instead of a runtime failure.
 */
export interface CreateRippleTrustlineRequest extends RippleDetailsCommon {
  type: "ripple_create_trustline";
  asset_identifier: RippleTrustLineAssetIdentifier;
}

/**
 * A CheckCash that cashes the check created by the referenced transaction.
 * Fordefi pushes a TrustSet first if the vault has no trust line yet.
 */
export interface CreateRippleCashCheckRequest extends RippleDetailsCommon {
  type: "ripple_cash_check";
  /** Fordefi UUID of the source CheckCreate transaction. */
  transaction_id: string;
}

export type RippleTransactionDetails =
  | CreateRippleTransferRequest
  | CreateRippleTrustlineRequest
  | CreateRippleCashCheckRequest;

// --- Requests ---------------------------------------------------------------

export interface CreateRippleTransactionRequest {
  vault_id: string;
  type: "ripple_transaction";
  details: RippleTransactionDetails;
  signer_type?: SignerType;
  sign_mode?: SignMode;
  note?: string;
  considered_as_stuck_after_seconds?: number;
}

export interface PredictRippleTransactionRequest {
  vault_id: string;
  type: "ripple_transaction";
  details: RippleTransactionDetails;
  note?: string;
  should_run_policy_check?: boolean;
}

// --- Responses --------------------------------------------------------------

export type TransactionState =
  | "waiting_for_approval"
  | "waiting_for_signing_trigger"
  | "approved"
  | "finalized_for_signing"
  | "signed"
  | "pushed_to_blockchain"
  | "mined"
  | "completed"
  | "aborted"
  | "error_pushing_to_blockchain"
  | "mined_reverted"
  | "completed_reverted"
  | "error_signing"
  | "stuck"
  | "dropped"
  | "queued"
  | "accelerating"
  | "canceling"
  | "accelerated"
  | "cancelled"
  | "insufficient_funds";

export type MinedResultStatus = "success" | "missing" | "potentially_partial";
export type ClaimStatus = "claimable" | "claimed";
export type TransactionDirection = "outgoing" | "incoming";

export type RippleReversionState =
  | "not_reverted"
  | "unknown_revert"
  | "insufficient_funds_gas_and_value"
  | "missing_recipient_trustline"
  | "transaction_rejected";

export interface RippleAssetInfo {
  id?: string;
  symbol?: string;
  name?: string;
  /**
   * How many base units make one whole token: an on-the-wire `value`, `amount`,
   * `diff` or `fee_charged` is an integer count of 10^-decimals of a token.
   * Native XRP is 6 (drops); XRPL trust-line assets are 15.
   */
  decimals?: number;
  [key: string]: unknown;
}

/**
 * Note the nesting: the symbol and decimals live under `asset_info`, not on
 * `priced_asset` itself.
 */
export interface PricedAsset {
  type?: string;
  asset_info?: RippleAssetInfo;
  price?: { price?: string; price_float?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface EnrichedRippleAddress {
  type: "ripple";
  address: string;
  explorer_url?: string;
  vault?: { id?: string; name?: string } | null;
  contact?: { id?: string; name?: string } | null;
}

export interface RippleTransferEffect {
  amount: string;
  from: EnrichedRippleAddress;
  to: EnrichedRippleAddress;
  priced_asset: PricedAsset;
}

export interface RippleBalanceChangeEffect {
  address: EnrichedRippleAddress;
  diff: string;
  priced_asset: PricedAsset;
}

export interface RippleTrustlineChangeEffect {
  address: EnrichedRippleAddress;
  limit: string;
  priced_asset: PricedAsset;
}

export interface RippleEffects {
  transfers: RippleTransferEffect[];
  balance_changes: RippleBalanceChangeEffect[];
  trustline_changes?: RippleTrustlineChangeEffect[];
}

export interface RippleFee {
  fee_charged: string;
  priced_asset: PricedAsset;
}

export interface RippleReversion {
  state: RippleReversionState;
  reason?: string;
}

export interface RippleTransactionResult {
  effects: RippleEffects;
  fee: RippleFee;
  /** Present when the operation also had to pay for a TrustSet. */
  trustline_fee?: RippleFee;
  reversion: RippleReversion;
}

export type RippleTransactionTypeDetails =
  | { type: "native_transfer"; sender: EnrichedRippleAddress; recipient?: EnrichedRippleAddress; tag?: string; is_internal?: boolean }
  | { type: "trust_line_asset_transfer"; sender: EnrichedRippleAddress; recipient?: EnrichedRippleAddress; tag?: string; is_internal?: boolean }
  | { type: "create_trustline"; recipient?: EnrichedRippleAddress }
  | { type: "cash_check"; recipient?: EnrichedRippleAddress }
  | { type: "raw_transaction"; recipient?: EnrichedRippleAddress };

export interface Signature {
  data?: string;
  [key: string]: unknown;
}

export interface RippleTransaction {
  id: string;
  type: "ripple_transaction";
  state: TransactionState;
  hash?: string;
  explorer_url?: string;
  direction?: TransactionDirection;
  /** Ledger object ID of the XRPL Check this transaction created or referenced. */
  check_id?: string | null;
  /** `claimable` for trust-line transfers delivered as a check the recipient can cash. */
  claim_status?: ClaimStatus | null;
  note?: string;
  created_at?: string;
  modified_at?: string;
  sender?: EnrichedRippleAddress;
  ripple_transaction_type_details?: RippleTransactionTypeDetails;
  expected_result?: RippleTransactionResult;
  mined_result?: RippleTransactionResult;
  mined_result_status?: MinedResultStatus;
  signatures?: Signature[];
  error?: string;
}

/** `POST /transactions/predict` response for a Ripple transaction. */
export interface PredictedRippleTransaction {
  type: "ripple_transaction";
  chain: { unique_id?: string; name?: string; [key: string]: unknown };
  sender: EnrichedRippleAddress;
  expected_result: RippleTransactionResult;
  ripple_transaction_type_details?: RippleTransactionTypeDetails;
  claim_status?: ClaimStatus | null;
  note?: string;
  matched_policies?: unknown[];
  risks?: unknown[];
  simulation_status_result?: { simulation_status?: string; details?: string };
}

/** `GET /transactions` envelope. */
export interface ListTransactionsResponse {
  total: number;
  page: number;
  size: number;
  transactions: RippleTransaction[];
}

export interface ListTransactionsQuery {
  vault_ids?: string[];
  chains?: string[];
  direction?: TransactionDirection;
  claimed?: boolean;
  states?: string[];
  types?: string[];
  page?: number;
  size?: number;
}
