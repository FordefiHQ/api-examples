import axios from "axios";
import {
  FordefiStarknetConfig,
  CreateStarknetTransactionRequest,
  StarknetTransactionResponse,
} from "./interfaces.js";
import { signFordefiApiPayload } from "./signer.js";
import {FORDEFI_API_BASE_URL, TRANSACTIONS_API_PATH } from '../config.js'


function currentTimestampSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function fordefiAuthHeaders(
  config: FordefiStarknetConfig,
  path: string,
  timestamp: number,
  requestBody: string
) {
  return {
    Authorization: `Bearer ${config.accessToken}`,
    "x-signature": signFordefiApiPayload(config.apiPayloadSignKey, path, timestamp, requestBody),
    "x-timestamp": timestamp.toString(),
    "Content-Type": "application/json",
  };
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export async function createTransaction(
  config: FordefiStarknetConfig,
  request: CreateStarknetTransactionRequest
): Promise<StarknetTransactionResponse> {
  const path = TRANSACTIONS_API_PATH;
  const url = `${FORDEFI_API_BASE_URL}${path}`;
  const timestamp = currentTimestampSeconds();
  const requestBody = JSON.stringify(request);

  console.log("Submitting Starknet contract call via Fordefi...");

  const response = await axios.post<StarknetTransactionResponse>(url, requestBody, {
    headers: fordefiAuthHeaders(config, path, timestamp, requestBody),
    validateStatus: () => true,
  });

  if (!isSuccessStatus(response.status)) {
    throw new Error(`HTTP error ${response.status}: ${JSON.stringify(response.data)}`);
  }

  console.log(`Transaction created with ID: ${response.data.id}`);
  return response.data;
}

export async function getTransactionStatus(
  config: FordefiStarknetConfig,
  transactionId: string
): Promise<StarknetTransactionResponse> {
  const path = `${TRANSACTIONS_API_PATH}/${transactionId}`;
  const url = `${FORDEFI_API_BASE_URL}${path}`;
  const timestamp = currentTimestampSeconds();

  const response = await axios.get<StarknetTransactionResponse>(url, {
    headers: fordefiAuthHeaders(config, path, timestamp, ""),
    validateStatus: () => true,
  });

  if (!isSuccessStatus(response.status)) {
    throw new Error(`HTTP error ${response.status}: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

const TERMINAL_SUCCESS_STATES = new Set(["mined", "completed", "signed", "pushed_to_blockchain"]);
const TERMINAL_FAILURE_STATES = new Set(["failed", "aborted"]);

export interface PollOptions {
  maxAttempts?: number;
  pollIntervalMs?: number;
}

export async function pollUntilComplete(
  config: FordefiStarknetConfig,
  transactionId: string,
  options: PollOptions = {}
): Promise<StarknetTransactionResponse> {
  const maxAttempts = options.maxAttempts ?? 60;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await getTransactionStatus(config, transactionId);

    if (TERMINAL_SUCCESS_STATES.has(response.state)) {
      console.log(`Transaction ${transactionId} reached state: ${response.state}`);
      return response;
    }

    if (TERMINAL_FAILURE_STATES.has(response.state)) {
      const errorDetail = response.error ? ` - ${response.error}` : "";
      throw new Error(`Transaction ${transactionId} failed: ${response.state}${errorDetail}`);
    }

    console.log(`Waiting for transaction... (attempt ${attempt + 1}/${maxAttempts}, state: ${response.state})`);
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for transaction ${transactionId}`);
}

export async function submitContractCall(
  config: FordefiStarknetConfig,
  request: CreateStarknetTransactionRequest,
  options: PollOptions = {}
): Promise<StarknetTransactionResponse> {
  const created = await createTransaction(config, request);
  return pollUntilComplete(config, created.id, options);
}
