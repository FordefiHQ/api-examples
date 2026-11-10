import crypto from 'crypto';
import { FordefiSolanaConfig } from '../src/config';

// POST requests need a signature over `<path>|<timestamp>|<body>` made with
// the API User private key. GET requests need only the bearer token.
export function signApiRequestPayload(payload: string, privateKeyPem: string): string {
  const signature = crypto.createSign('SHA256').update(payload, 'utf8').end();
  return signature.sign(crypto.createPrivateKey(privateKeyPem), 'base64');
}

export async function fordefiPost(fordefiConfig: FordefiSolanaConfig, path: string, body: unknown): Promise<any> {
  const requestBody = JSON.stringify(body);
  const timestamp = Date.now();
  const signature = signApiRequestPayload(`${path}|${timestamp}|${requestBody}`, fordefiConfig.privateKeyPem);
  const response = await fetch(`${fordefiConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fordefiConfig.accessToken}`,
      'x-signature': signature,
      'x-timestamp': String(timestamp),
      'x-idempotence-id': crypto.randomUUID(),
      'Content-Type': 'application/json',
    },
    body: requestBody,
  });
  if (!response.ok) {
    throw new Error(`POST ${path} -> ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function fordefiGet(fordefiConfig: FordefiSolanaConfig, path: string): Promise<any> {
  const response = await fetch(`${fordefiConfig.apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${fordefiConfig.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const TERMINAL_SUCCESS_STATES = new Set(['completed']);
const TERMINAL_FAILURE_STATES = new Set([
  'aborted', 'cancelled', 'completed_reverted', 'dropped', 'error_pushing_to_blockchain',
  'error_signing', 'insufficient_funds', 'rejected', 'stuck',
]);

// Polls GET /api/v1/transactions/{id} until the transaction reaches a terminal
// state, and logs each state change.
export async function pollUntilTerminal(
  fordefiConfig: FordefiSolanaConfig,
  txId: string,
  { intervalMs = 2000, maxAttempts = 60 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<any> {
  let lastState = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tx = await fordefiGet(fordefiConfig, `/api/v1/transactions/${txId}`);
    const state: string = tx.state;
    if (state !== lastState) {
      console.log(`  state: ${state} (${attempt}/${maxAttempts})`);
      lastState = state;
    }
    if (TERMINAL_SUCCESS_STATES.has(state)) return tx;
    if (TERMINAL_FAILURE_STATES.has(state)) {
      throw new Error(`Transaction ${txId} reached terminal state ${state}`);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for transaction ${txId}; last state: ${lastState}`);
}
