import axios from "axios";
import { randomUUID } from "crypto";
import {
  CreateRippleTransactionRequest,
  FordefiRippleConfig,
  ListTransactionsQuery,
  ListTransactionsResponse,
  PredictRippleTransactionRequest,
  PredictedRippleTransaction,
  RippleTransaction,
  TransactionState,
} from "./interfaces.js";
import { formatAmount } from "./amounts.js";
import { signFordefiApiPayload } from "./signer.js";

export const FORDEFI_API_BASE_URL = "https://api.fordefi.com";
export const TRANSACTIONS_API_PATH = "/api/v1/transactions";
export const PREDICT_API_PATH = "/api/v1/transactions/predict";

function currentTimestampSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Bearer-only headers. Per the OpenAPI spec, `POST /transactions/predict`,
 * `GET /transactions` and `GET /transactions/{id}` do not declare
 * `x-signature` / `x-timestamp` — only the write endpoints do.
 */
function authHeaders(config: FordefiRippleConfig) {
  return {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
  };
}

/** Headers for endpoints that require the RSA request-payload signature. */
function signedAuthHeaders(
  config: FordefiRippleConfig,
  path: string,
  requestBody: string
) {
  const timestamp = currentTimestampSeconds();
  return {
    ...authHeaders(config),
    "x-signature": signFordefiApiPayload(
      config.apiPayloadSignKey,
      path,
      timestamp,
      requestBody
    ),
    "x-timestamp": timestamp.toString(),
  };
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function assertSuccess(status: number, data: unknown): void {
  if (!isSuccessStatus(status)) {
    throw new Error(`HTTP error ${status}: ${JSON.stringify(data)}`);
  }
}

/**
 * Dry run: asks Fordefi what the transaction would do without creating it.
 * Never reaches the signing phase, so the API Signer does not need to be running.
 */
export async function predictTransaction(
  config: FordefiRippleConfig,
  request: PredictRippleTransactionRequest
): Promise<PredictedRippleTransaction> {
  const url = `${FORDEFI_API_BASE_URL}${PREDICT_API_PATH}`;

  const response = await axios.post<PredictedRippleTransaction>(url, request, {
    headers: authHeaders(config),
    validateStatus: () => true,
  });

  assertSuccess(response.status, response.data);
  return response.data;
}

export async function createTransaction(
  config: FordefiRippleConfig,
  request: CreateRippleTransactionRequest
): Promise<RippleTransaction> {
  const url = `${FORDEFI_API_BASE_URL}${TRANSACTIONS_API_PATH}`;
  const requestBody = JSON.stringify(request);

  console.log(`Submitting ${request.details.type} via Fordefi...`);

  const response = await axios.post<RippleTransaction>(url, requestBody, {
    headers: {
      ...signedAuthHeaders(config, TRANSACTIONS_API_PATH, requestBody),
      // Optional per the spec, but it makes a retried create safe to repeat.
      "x-idempotence-id": randomUUID(),
    },
    validateStatus: () => true,
  });

  assertSuccess(response.status, response.data);

  console.log(`Transaction created with ID: ${response.data.id}`);
  return response.data;
}

export async function getTransaction(
  config: FordefiRippleConfig,
  transactionId: string
): Promise<RippleTransaction> {
  const url = `${FORDEFI_API_BASE_URL}${TRANSACTIONS_API_PATH}/${transactionId}`;

  const response = await axios.get<RippleTransaction>(url, {
    headers: authHeaders(config),
    validateStatus: () => true,
  });

  assertSuccess(response.status, response.data);
  return response.data;
}

export async function listTransactions(
  config: FordefiRippleConfig,
  query: ListTransactionsQuery = {}
): Promise<ListTransactionsResponse> {
  const url = `${FORDEFI_API_BASE_URL}${TRANSACTIONS_API_PATH}`;

  const response = await axios.get<ListTransactionsResponse>(url, {
    headers: authHeaders(config),
    params: query,
    // Repeat array params as `?vault_ids=a&vault_ids=b`, which is what the API expects.
    paramsSerializer: { indexes: null },
    validateStatus: () => true,
  });

  assertSuccess(response.status, response.data);
  return response.data;
}

const TERMINAL_SUCCESS_STATES = new Set<TransactionState>(["mined", "completed"]);

const TERMINAL_FAILURE_STATES = new Set<TransactionState>([
  "aborted",
  "cancelled",
  "dropped",
  "stuck",
  "error_signing",
  "error_pushing_to_blockchain",
  "mined_reverted",
  "completed_reverted",
  "insufficient_funds",
]);

export interface PollOptions {
  maxAttempts?: number;
  pollIntervalMs?: number;
}

/** Renders the XRPL-specific outcome fields: a transaction can be mined and still revert. */
export function describeOutcome(transaction: RippleTransaction): string[] {
  const lines: string[] = [`State: ${transaction.state}`];

  if (transaction.mined_result_status) {
    lines.push(`Mined result status: ${transaction.mined_result_status}`);
  }

  const reversion = transaction.mined_result?.reversion;
  if (reversion && reversion.state !== "not_reverted") {
    lines.push(
      `Reverted: ${reversion.state}${reversion.reason ? ` - ${reversion.reason}` : ""}`
    );
  }

  const fee = transaction.mined_result?.fee;
  if (fee?.fee_charged) {
    lines.push(`Fee charged: ${formatAmount(fee.fee_charged, fee.priced_asset)}`);
  }

  const trustlineFee = transaction.mined_result?.trustline_fee;
  if (trustlineFee?.fee_charged) {
    lines.push(
      `Trust line fee charged: ${formatAmount(trustlineFee.fee_charged, trustlineFee.priced_asset)}`
    );
  }

  if (transaction.hash) lines.push(`Hash: ${transaction.hash}`);
  if (transaction.explorer_url) lines.push(`View: ${transaction.explorer_url}`);

  return lines;
}

/**
 * Polls until the transaction is mined or completed. `signed` and
 * `pushed_to_blockchain` are deliberately not treated as terminal: XRPL closes a
 * ledger every ~4 seconds, so waiting for the mined result is cheap and tells us
 * whether the transaction actually succeeded.
 */
export async function pollUntilComplete(
  config: FordefiRippleConfig,
  transactionId: string,
  options: PollOptions = {}
): Promise<RippleTransaction> {
  const maxAttempts = options.maxAttempts ?? 60;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const transaction = await getTransaction(config, transactionId);

    if (TERMINAL_FAILURE_STATES.has(transaction.state)) {
      throw new Error(
        `Transaction ${transactionId} failed: ${describeOutcome(transaction).join(", ")}`
      );
    }

    if (TERMINAL_SUCCESS_STATES.has(transaction.state)) {
      const reversion = transaction.mined_result?.reversion;
      if (reversion && reversion.state !== "not_reverted") {
        throw new Error(
          `Transaction ${transactionId} was mined but reverted: ${describeOutcome(transaction).join(", ")}`
        );
      }
      return transaction;
    }

    console.log(
      `Waiting for transaction... (attempt ${attempt + 1}/${maxAttempts}, state: ${transaction.state})`
    );
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for transaction ${transactionId}`);
}

export async function submitTransaction(
  config: FordefiRippleConfig,
  request: CreateRippleTransactionRequest,
  options: PollOptions = {}
): Promise<RippleTransaction> {
  const created = await createTransaction(config, request);
  return pollUntilComplete(config, created.id, options);
}
