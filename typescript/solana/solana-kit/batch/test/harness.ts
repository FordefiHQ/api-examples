// Offline stand-ins for the Fordefi API and a Solana RPC node, both backed by LiteSVM, so an
// example's real entrypoint can run end to end without credentials, funds or network access.
// Every fetch() is intercepted: requests to api.fordefi.com are served by the mock Fordefi
// API, and any other JSON-RPC request is treated as an RPC (or Jito) call against LiteSVM.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as kit from '@solana/kit';
import { AccountState, TOKEN_PROGRAM_ADDRESS, getMintEncoder, getTokenEncoder } from '@solana-program/token';
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';

const FORDEFI_HOST = 'api.fordefi.com';
const TRANSACTIONS_PATH = '/api/v1/transactions';

export interface MockVault {
  id: string;
  address: kit.Address;
  sign(bytes: Uint8Array): Uint8Array;
}

/** A Fordefi vault whose MPC key is played by a local ed25519 key. */
export function createVault(id: string): MockVault {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const rawPublicKey = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url');
  return {
    id,
    address: kit.getAddressDecoder().decode(rawPublicKey),
    sign: bytes => new Uint8Array(crypto.sign(null, bytes, privateKey)),
  };
}

export interface FordefiRequest {
  body: any;
  idempotenceId: string | null;
}

export interface SentTransaction {
  host: string;
  signature: string;
}

/** Every transaction handed to LiteSVM for broadcast, including the ones it rejected. */
export interface BroadcastAttempt {
  host: string;
  transaction: kit.Transaction;
  error?: string;
}

export interface Mocks {
  svm: LiteSVM;
  fordefiRequests: FordefiRequest[];
  sentTransactions: SentTransaction[];
  broadcastAttempts: BroadcastAttempt[];
  restore(): void;
}

/**
 * Give the example a fresh API User key through FORDEFI_PRIVATE_KEY_PATH (so the shared
 * solana-kit/secret/private.pem is never read) plus the given env vars, and run it from a scratch
 * directory. Env vars set here win over anything in a real .env.
 */
export function prepareWorkdir(env: Record<string, string>): crypto.KeyObject {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fordefi-example-'));
  const privateKeyPath = path.join(dir, 'private.pem');
  fs.writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  process.chdir(dir);
  Object.assign(process.env, env, { FORDEFI_PRIVATE_KEY_PATH: privateKeyPath });
  return publicKey;
}

export function installMocks(options: {
  svm: LiteSVM;
  vaults: MockVault[];
  apiUserPublicKey: crypto.KeyObject;
  /** Emulate Fordefi refreshing the blockhash before it signs (default: true). */
  rewriteBlockhash?: boolean;
}): Mocks {
  const { svm, vaults, apiUserPublicKey, rewriteBlockhash = true } = options;
  const realFetch = globalThis.fetch;
  const fordefiRequests: FordefiRequest[] = [];
  const sentTransactions: SentTransaction[] = [];
  const broadcastAttempts: BroadcastAttempt[] = [];
  const fordefiTransactions = new Map<string, object>();
  const landedSignatures = new Set<string>();

  function send(transaction: kit.Transaction, host: string): FailedTransactionMetadata | string {
    const result = svm.sendTransaction(transaction);
    if (result instanceof FailedTransactionMetadata) {
      broadcastAttempts.push({ host, transaction, error: result.toString() });
      return result;
    }
    broadcastAttempts.push({ host, transaction });
    const signature = kit.getBase58Decoder().decode(result.signature());
    landedSignatures.add(signature);
    sentTransactions.push({ host, signature });
    return signature;
  }

  function handleFordefi(url: URL, init: RequestInit): Response {
    const headers = new Headers(init.headers);
    if (!headers.get('authorization')?.startsWith('Bearer ')) {
      return json(401, { detail: 'missing bearer token' });
    }

    if (init.method === 'GET') {
      const transaction = fordefiTransactions.get(url.pathname.slice(TRANSACTIONS_PATH.length + 1));
      return transaction ? json(200, transaction) : json(404, { detail: 'not found' });
    }

    const body = String(init.body);
    const payload = `${url.pathname}|${headers.get('x-timestamp')}|${body}`;
    const signature = Buffer.from(headers.get('x-signature') ?? '', 'base64');
    if (!crypto.verify('sha256', Buffer.from(payload), apiUserPublicKey, signature)) {
      return json(401, { detail: 'invalid x-signature' });
    }

    const request = JSON.parse(body);
    fordefiRequests.push({ body: request, idempotenceId: headers.get('x-idempotence-id') });
    const vault = vaults.find(v => v.id === request.vault_id);
    if (!vault) {
      return json(404, { detail: `unknown vault ${request.vault_id}` });
    }

    const id = crypto.randomUUID();
    if (request.type === 'solana_transaction') {
      let messageBytes: Uint8Array = Buffer.from(request.details.data, 'base64');
      const compiled = kit.getCompiledTransactionMessageDecoder().decode(messageBytes);
      if (rewriteBlockhash) {
        // The caller's blockhash stops being valid, so the example only succeeds if it
        // continues from the transaction Fordefi returns rather than the one it submitted.
        svm.expireBlockhash();
        messageBytes = new Uint8Array(
          kit.getCompiledTransactionMessageEncoder().encode({ ...compiled, lifetimeToken: svm.latestBlockhash() }),
        );
      }
      const vaultSignature = vault.sign(messageBytes);
      const signers = compiled.staticAccounts.slice(0, compiled.header.numSignerAccounts);
      const transaction = {
        messageBytes,
        signatures: Object.fromEntries(signers.map(a => [a, a === vault.address ? vaultSignature : null])),
      } as unknown as kit.Transaction;

      let state = 'signed';
      if (request.details.push_mode === 'auto') {
        state = typeof send(transaction, FORDEFI_HOST) === 'string' ? 'completed' : 'error_pushing_to_blockchain';
      }
      fordefiTransactions.set(id, {
        id,
        state,
        raw_transaction: kit.getBase64EncodedWireTransaction(transaction),
        signatures: [{ data: Buffer.from(vaultSignature).toString('base64') }],
      });
    } else {
      const data = request.type === 'black_box_signature' ? request.details.hash_binary : request.details.raw_data;
      const signatureData = Buffer.from(vault.sign(Buffer.from(data, 'base64'))).toString('base64');
      fordefiTransactions.set(id, { id, state: 'completed', signatures: [{ data: signatureData }] });
    }
    return json(201, { id });
  }

  function handleRpc(host: string, { id, method, params }: { id: unknown; method: string; params: any[] }): Response {
    const context = { slot: 1 };
    const accountInfo = (address: kit.Address) => {
      const account = svm.getAccount(address);
      if (!account.exists) {
        return null;
      }
      return {
        data: [Buffer.from(account.data).toString('base64'), 'base64'],
        executable: account.executable,
        lamports: Number(account.lamports),
        owner: account.programAddress,
        rentEpoch: 0,
        space: account.data.length,
      };
    };

    switch (method) {
      case 'getLatestBlockhash':
        return rpcResult(id, { context, value: { blockhash: svm.latestBlockhash(), lastValidBlockHeight: 1_000_000 } });
      case 'getMinimumBalanceForRentExemption':
        return rpcResult(id, Number(svm.minimumBalanceForRentExemption(BigInt(params[0]))));
      case 'getAccountInfo':
        return rpcResult(id, { context, value: accountInfo(params[0]) });
      case 'getMultipleAccounts':
        return rpcResult(id, { context, value: params[0].map(accountInfo) });
      case 'getStakeMinimumDelegation':
        // LiteSVM enables every feature, including the 1 SOL minimum delegation that mainnet enforces
        return rpcResult(id, { context, value: 1_000_000_000 });
      case 'getBalance':
        return rpcResult(id, { context, value: Number(svm.getBalance(params[0]) ?? 0n) });
      case 'getSignatureStatuses':
        return rpcResult(id, {
          context,
          value: params[0].map((signature: string) =>
            landedSignatures.has(signature)
              ? { slot: 1, confirmations: null, err: null, confirmationStatus: 'finalized' }
              : null,
          ),
        });
      case 'sendTransaction': {
        const transaction = kit.getTransactionDecoder().decode(Buffer.from(params[0], 'base64'));
        const result = send(transaction, host);
        if (typeof result === 'string') {
          return rpcResult(id, result);
        }
        return json(200, {
          jsonrpc: '2.0',
          id,
          error: { code: -32002, message: `Transaction simulation failed: ${result.toString()}`, data: { logs: result.meta().logs() } },
        });
      }
      default:
        return json(200, { jsonrpc: '2.0', id, error: { code: -32601, message: `mock RPC does not implement ${method}` } });
    }
  }

  globalThis.fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.host === FORDEFI_HOST) {
      return handleFordefi(url, init);
    }
    return handleRpc(url.host, JSON.parse(String(init.body)));
  };

  return { svm, fordefiRequests, sentTransactions, broadcastAttempts, restore: () => (globalThis.fetch = realFetch) };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function rpcResult(id: unknown, result: unknown): Response {
  return json(200, { jsonrpc: '2.0', id, result });
}

export function fundAccount(svm: LiteSVM, address: kit.Address, sol = 10n): void {
  svm.airdrop(address, kit.lamports(sol * 1_000_000_000n));
}

export function setMint(svm: LiteSVM, mint: kit.Address, decimals: number, programAddress: kit.Address = TOKEN_PROGRAM_ADDRESS): void {
  const data = new Uint8Array(
    getMintEncoder().encode({ mintAuthority: null, supply: 1n << 60n, decimals, isInitialized: true, freezeAuthority: null }),
  );
  setProgramAccount(svm, mint, data, programAddress);
}

export function setTokenAccount(
  svm: LiteSVM,
  account: { address: kit.Address; mint: kit.Address; owner: kit.Address; amount: bigint },
  programAddress: kit.Address = TOKEN_PROGRAM_ADDRESS,
): void {
  const data = new Uint8Array(
    getTokenEncoder().encode({
      mint: account.mint,
      owner: account.owner,
      amount: account.amount,
      delegate: null,
      state: AccountState.Initialized,
      isNative: null,
      delegatedAmount: 0n,
      closeAuthority: null,
    }),
  );
  setProgramAccount(svm, account.address, data, programAddress);
}

export function setProgramAccount(svm: LiteSVM, address: kit.Address, data: Uint8Array, programAddress: kit.Address): void {
  svm.setAccount({
    address,
    data,
    executable: false,
    lamports: kit.lamports(svm.minimumBalanceForRentExemption(BigInt(data.length))),
    programAddress,
    space: BigInt(data.length),
  });
}

export function tokenBalance(svm: LiteSVM, address: kit.Address): bigint {
  const account = svm.getAccount(address);
  if (!account.exists) {
    return 0n;
  }
  // amount is the u64 after the 32-byte mint and 32-byte owner
  return Buffer.from(account.data).readBigUInt64LE(64);
}
