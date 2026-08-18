import {
  Horizon,
  TransactionBuilder,
  Transaction,
  BASE_FEE,
  Networks,
  Operation,
  Keypair,
  xdr,
} from "@stellar/stellar-sdk";
import axios from "axios";
import { fordefiConfig, sponsoredReservesConfig as cfg } from "./config.js";
import {
  CreateStellarTransactionRequest,
  StellarTransactionResponse,
  submitTransaction,
  FORDEFI_API_BASE_URL,
  TRANSACTIONS_API_PATH,
} from "../../fordefi/index.js";
// signer.ts is deliberately not re-exported from the shared barrel; import it directly.
import { signFordefiApiPayload } from "../../fordefi/signer.js";

// Base reserve on Stellar mainnet, in XLM. A new account costs 2 of them and
// each subentry (here: the trustline) costs 1.
const BASE_RESERVE_XLM = 0.5;
// numSponsoring/numSponsored count RESERVE UNITS, not ledger entries: an account
// entry is worth 2 and each subentry 1. Creating the account (2) plus its
// trustline (1) is 3 units — verified on-chain, not assumed.
export const SPONSORED_RESERVE_UNITS = 2 + 1;
export const EXPECTED_LOCKED_XLM = SPONSORED_RESERVE_UNITS * BASE_RESERVE_XLM;

function horizon(): Horizon.Server {
  return new Horizon.Server(cfg.horizonUrl);
}

export async function loadAccountRecord(address: string): Promise<Horizon.ServerApi.AccountRecord> {
  return horizon().accounts().accountId(address).call();
}

export function nativeBalance(account: Horizon.ServerApi.AccountRecord): string {
  const native = account.balances.find((b) => b.asset_type === "native");
  return native ? native.balance : "0";
}

export interface VaultState {
  balance: string;
  numSponsoring: number;
  subentryCount: number;
}

export async function readVaultState(): Promise<VaultState> {
  const account = await loadAccountRecord(cfg.vaultAddress);
  return {
    balance: nativeBalance(account),
    numSponsoring: account.num_sponsoring,
    subentryCount: account.subentry_count,
  };
}

// The sponsorship sandwich, per CAP-33: BeginSponsoringFutureReserves is sourced
// by the sponsor, EndSponsoringFutureReserves by the sponsored account, and every
// reserve-increasing operation sits between them. No is-sponsoring relationship
// may still be open when the transaction ends, which is why all four operations
// have to travel together in one envelope.
//
// The vault is the envelope source: Fordefi rejects stellar_raw_transaction with
// INVALID_VAULT_FIELD if the named vault isn't the source account.
export async function buildSponsorshipTx(): Promise<Transaction> {
  const sourceAccount = await horizon().loadAccount(cfg.vaultAddress);

  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    // 1. Sponsor opens the sandwich. Source defaults to the envelope source (the vault).
    .addOperation(
      Operation.beginSponsoringFutureReserves({ sponsoredId: cfg.sponsoredPubkey })
    )
    // 2. Create the account with a ZERO starting balance — its 2 base reserves
    //    land on the sponsor's numSponsoring instead of being funded from here.
    .addOperation(
      Operation.createAccount({ destination: cfg.sponsoredPubkey, startingBalance: "0" })
    )
    // 3. The trustline subentry, also sponsored. Sourced by the account created
    //    in op 2 — it exists by the time this operation runs.
    .addOperation(Operation.changeTrust({ asset: cfg.asset, source: cfg.sponsoredPubkey }))
    // 4. Sponsored account closes the sandwich. MUST be sourced by the sponsored
    //    account — this is the operation that requires its signature.
    .addOperation(Operation.endSponsoringFutureReserves({ source: cfg.sponsoredPubkey }))
    .setTimeout(cfg.txTimeoutSecs)
    .build();
}

// Revoking is unilateral: RevokeSponsorship is signed by the SPONSOR alone, and
// the sponsored account does not sign. That makes this a single-signature
// transaction — no co-signing, no envelope recovery, and it can use
// push_mode="auto" so Fordefi broadcasts it directly.
//
// What revoking does NOT do is hand the reserves back to the sponsor. It moves
// the reserve obligation to the sponsored account, which must then cover it from
// its own balance; if it cannot, the operation fails with
// REVOKE_SPONSORSHIP_LOW_RESERVE. Removing the entries outright (ChangeTrust to
// limit 0, then AccountMerge) is what actually returns the XLM to the vault.
export async function buildRevokeTx(): Promise<Transaction> {
  const sourceAccount = await horizon().loadAccount(cfg.vaultAddress);

  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    // Subentry first, then the account entry it hangs off.
    .addOperation(
      Operation.revokeTrustlineSponsorship({
        account: cfg.sponsoredPubkey,
        asset: cfg.asset,
      })
    )
    .addOperation(Operation.revokeAccountSponsorship({ account: cfg.sponsoredPubkey }))
    .setTimeout(cfg.txTimeoutSecs)
    .build();
}

// Fordefi broadcasts auto-push transactions itself, so on failure we have to go
// to Horizon for the actual reason. Decodes the per-operation result codes out of
// the transaction result XDR.
export async function reportLedgerResult(hash: string): Promise<boolean> {
  // Horizon indexes a few hundred ms behind the push, so a lookup issued right
  // after Fordefi reports pushed_to_blockchain will 404. Retry briefly.
  let record: { successful?: boolean; result_xdr?: string } | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      record = await horizon().transactions().transaction(hash).call();
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  if (!record) {
    console.log(`  (${hash} still not visible on Horizon after 20s)`);
    return false;
  }

  console.log(`\nLedger result for ${hash}`);
  console.log(`  successful: ${record.successful}`);
  if (!record.result_xdr) return record.successful === true;

  const result = xdr.TransactionResult.fromXDR(record.result_xdr, "base64");
  console.log(`  transaction result: ${result.result().switch().name}`);
  try {
    result
      .result()
      .results()
      .forEach((r, i) => {
        const tr = r.tr();
        console.log(
          `  op[${i}]: ${tr.switch().name} -> ${(tr.value() as { switch(): { name: string } }).switch().name}`
        );
      });
  } catch {
    // Some failure modes carry no per-operation results.
  }
  return record.successful === true;
}

export function describeOperations(tx: Transaction): string[] {
  return tx.operations.map(
    (op, i) => `  op[${i}] ${op.type}  source=${op.source ?? "(envelope source)"}`
  );
}

function dumpFordefiResponse(result: StellarTransactionResponse): void {
  console.log("Fordefi response:");
  console.log(`  id:    ${result.id}`);
  console.log(`  state: ${result.state}`);
  if (result.hash) console.log(`  hash:  ${result.hash}`);
  if (result.error) console.log(`  error: ${result.error}`);
  console.log(`  signatures: ${result.signatures ? result.signatures.length : 0}`);
  const sst = result.serialized_signed_transaction;
  console.log(
    sst
      ? `  serialized_signed_transaction: ${sst.length} chars`
      : "  serialized_signed_transaction: (none)"
  );
}

// Submit the locally-built sandwich to Fordefi with push_mode=manual. Fordefi
// rebuilds the envelope before signing (refreshed sequence, normalized fee), so
// the signature it returns verifies against ITS envelope, not ours — which is
// exactly why we take the returned envelope back and co-sign that one rather
// than trying to make Fordefi sign a hash we fixed in advance.
export async function signWithFordefi(xdr: string, note: string): Promise<string> {
  const request: CreateStellarTransactionRequest = {
    vault_id: fordefiConfig.vaultId,
    signer_type: "api_signer",
    type: "stellar_transaction",
    details: {
      type: "stellar_raw_transaction",
      chain: fordefiConfig.chain,
      xdr_data: xdr,
      push_mode: fordefiConfig.pushMode,
      // The envelope is deliberately under-signed at this point: the sponsored
      // account's signature is attached after Fordefi signs. Prediction will
      // flag that, and it must not abort the request.
      fail_on_prediction_failure: false,
    },
    note,
  };

  console.log("Signing with the sponsor vault via stellar_raw_transaction (push_mode=manual)...");
  const result = await submitTransaction(fordefiConfig, request, {
    // Manual-push transactions stop at `signed`; allow time for the envelope to
    // surface after signing.
    maxAttempts: 60,
    pollIntervalMs: 2000,
  });
  dumpFordefiResponse(result);

  const envelope = result.serialized_signed_transaction || result.raw_data;
  if (!envelope) {
    throw new Error(
      "Fordefi returned no signed envelope (serialized_signed_transaction or raw_data). " +
        "Without it there is nothing to attach the sponsored account's signature to."
    );
  }

  const parsed = txFromXdr(envelope);
  if (parsed.signatures.length === 0) {
    throw new Error("Fordefi returned an envelope with no embedded signatures — the vault did not sign");
  }
  console.log(`  envelope carries ${parsed.signatures.length} signature(s) after the vault signed`);

  return envelope;
}

function memoRepr(tx: Transaction): string {
  const value = tx.memo.value;
  if (value === undefined || value === null) return tx.memo.type;
  return `${tx.memo.type}:${Buffer.isBuffer(value) ? value.toString("hex") : String(value)}`;
}

// Fordefi rebuilds the envelope before signing. Sequence and fee changes are
// expected and harmless. Changes to the operation list are NOT: reordering the
// sandwich, dropping an operation, or re-sourcing EndSponsoringFutureReserves to
// the vault would all produce an envelope that either fails at Horizon or does
// something other than what we asked for. Fail loudly rather than broadcast it.
export function diffEnvelopes(submittedXdr: string, returnedXdr: string): void {
  const before = txFromXdr(submittedXdr);
  const after = txFromXdr(returnedXdr);

  const drift: string[] = [];
  const row = (label: string, a: string, b: string) => {
    if (a === b) {
      console.log(`  ${label.padEnd(12)} ${a}`);
    } else {
      console.log(`  ${label.padEnd(12)} ${a}`);
      console.log(`  ${" ".repeat(12)} -> ${b}   [CHANGED]`);
    }
  };

  console.log("\nEnvelope diff (submitted -> returned by Fordefi):");
  row("source", before.source, after.source);
  row("fee", before.fee, after.fee);
  row("sequence", before.sequence, after.sequence);
  row("minTime", before.timeBounds?.minTime ?? "(none)", after.timeBounds?.minTime ?? "(none)");
  row("maxTime", before.timeBounds?.maxTime ?? "(none)", after.timeBounds?.maxTime ?? "(none)");
  row("memo", memoRepr(before), memoRepr(after));
  row("op count", String(before.operations.length), String(after.operations.length));

  if (before.operations.length !== after.operations.length) {
    drift.push(`operation count changed: ${before.operations.length} -> ${after.operations.length}`);
  }
  const opCount = Math.max(before.operations.length, after.operations.length);
  for (let i = 0; i < opCount; i++) {
    const describe = (op: Transaction["operations"][number] | undefined) =>
      op ? `${op.type} source=${op.source ?? "(envelope source)"}` : "(missing)";
    const aDesc = describe(before.operations[i]);
    const bDesc = describe(after.operations[i]);
    row(`op[${i}]`, aDesc, bDesc);
    if (aDesc !== bDesc) drift.push(`op[${i}]: ${aDesc} -> ${bDesc}`);
  }

  if (before.source !== after.source) {
    drift.push(`envelope source changed: ${before.source} -> ${after.source}`);
  }

  if (drift.length > 0) {
    throw new Error(
      "Fordefi altered the structure of the sponsorship sandwich, not just sequence/fee:\n  " +
        drift.join("\n  ") +
        "\nBroadcasting this would not perform the sponsorship that was requested. Aborting."
    );
  }
  console.log("  => operation list intact; only sequence/fee were rebuilt.");
}

export function txFromXdr(xdr: string): Transaction {
  const parsed = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC);
  if (!("operations" in parsed)) {
    throw new Error("Expected a Transaction envelope, got a FeeBumpTransaction");
  }
  return parsed as Transaction;
}

export function loadSponsoredKeypair(): Keypair {
  // SPONSORED_ED25519_SECRET is validated at config-load time.
  return Keypair.fromSecret(cfg.sponsoredSecret);
}

// Attach the sponsored account's signature to the envelope Fordefi returned.
// tx.hash() here is the hash of the envelope Fordefi actually signed, which is
// what the vault signature already in tx.signatures verifies against — so both
// signatures co-validate. Appending a decorated signature does not change the hash.
export function attachSponsoredSignature(tx: Transaction, kp: Keypair): void {
  const hash = tx.hash();
  tx.addSignature(kp.publicKey(), kp.sign(hash).toString("base64"));
}

export async function broadcastToHorizon(tx: Transaction): Promise<string> {
  const result = await horizon().submitTransaction(tx);
  return result.hash;
}

export function explorerTxUrl(hash: string): string {
  return `${cfg.explorerBaseUrl}/tx/${hash}`;
}

export async function verifyOnChain(vaultBefore: VaultState): Promise<void> {
  console.log("\n=== On-chain verification ===");

  const sponsored = await loadAccountRecord(cfg.sponsoredPubkey);
  const xlm = nativeBalance(sponsored);
  const isCreditBalance = (
    b: Horizon.ServerApi.AccountRecord["balances"][number]
  ): b is Horizon.HorizonApi.BalanceLineAsset =>
    b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12";

  const trustline = sponsored.balances
    .filter(isCreditBalance)
    .find(
      (b) => b.asset_code === cfg.asset.getCode() && b.asset_issuer === cfg.asset.getIssuer()
    );

  console.log(`Sponsored account ${cfg.sponsoredPubkey}`);
  console.log(`  exists:        yes`);
  console.log(`  XLM balance:   ${xlm}${parseFloat(xlm) === 0 ? "  (zero, as intended)" : "  (expected 0)"}`);
  console.log(
    `  num_sponsored: ${sponsored.num_sponsored} reserve units (expected ${SPONSORED_RESERVE_UNITS}: 2 for the account + 1 for the trustline)`
  );
  const minBalance =
    (2 + sponsored.subentry_count + sponsored.num_sponsoring - sponsored.num_sponsored) *
    BASE_RESERVE_XLM;
  console.log(
    `  min balance:   ${minBalance} XLM  (2 + ${sponsored.subentry_count} subentries + ` +
      `${sponsored.num_sponsoring} - ${sponsored.num_sponsored}) x ${BASE_RESERVE_XLM}` +
      `${minBalance === 0 ? "  <- the whole point: it can hold assets with no XLM" : ""}`
  );
  if (!trustline) {
    console.log(`  ${cfg.asset.getCode()} trustline: NOT FOUND (expected present)`);
  } else {
    console.log(`  ${cfg.asset.getCode()} trustline: present, limit ${trustline.limit}`);
    // An unsponsored trustline has no `sponsor` field at all — that's the case
    // worth distinguishing, since it means the sandwich landed but the reserve
    // didn't transfer to the vault.
    const sponsor = "sponsor" in trustline ? trustline.sponsor : undefined;
    const verdict = sponsor
      ? sponsor === cfg.vaultAddress
        ? "  (the vault)"
        : "  (expected the vault!)"
      : "  (UNSPONSORED — expected the vault)";
    console.log(`  trustline sponsor: ${sponsor ?? "(none)"}${verdict}`);
  }

  const vaultAfter = await readVaultState();
  const sponsoringDelta = vaultAfter.numSponsoring - vaultBefore.numSponsoring;
  console.log(`\nSponsor vault ${cfg.vaultAddress}`);
  console.log(
    `  num_sponsoring: ${vaultBefore.numSponsoring} -> ${vaultAfter.numSponsoring} ` +
      `(+${sponsoringDelta} reserve units, expected +${SPONSORED_RESERVE_UNITS})`
  );
  console.log(`  XLM balance:    ${vaultBefore.balance} -> ${vaultAfter.balance} (fee only; reserves are locked, not spent)`);
  console.log(
    `  reserves now locked by this sponsorship: ${EXPECTED_LOCKED_XLM} XLM ` +
      `(2 reserve units for the account + 1 for the trustline)`
  );
  console.log(
    `  to release these reserves back to the vault, run \`npm run merge\` (removes the entries).` +
      `\n  \`npm run revoke\` does NOT reclaim them — it only moves the obligation to the sponsored` +
      `\n  account, and fails while that account cannot fund its own minimum balance.`
  );
}

// Unwind the sponsorship by REMOVING the entries rather than revoking them.
// Removing a sponsored entry ends the sponsorship and returns its reserve to the
// sponsor, so this is what actually puts the XLM back in the vault — a revoke
// only moves the obligation onto the sponsored account, and fails outright if
// that account cannot fund itself.
//
// Order matters: AccountMerge fails with ACCOUNT_MERGE_HAS_SUB_ENTRIES while any
// subentry remains, so the trustline has to go first, in the same transaction.
// Both operations are sourced by the sponsored account, so this needs its
// signature — the same co-sign flow as the sponsor run.
export async function buildMergeTx(): Promise<Transaction> {
  const sourceAccount = await horizon().loadAccount(cfg.vaultAddress);

  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    // Limit 0 removes the trustline; it must already hold a zero balance.
    .addOperation(
      Operation.changeTrust({ asset: cfg.asset, limit: "0", source: cfg.sponsoredPubkey })
    )
    // Sends any residual XLM to the vault and deletes the account entry.
    .addOperation(
      Operation.accountMerge({ destination: cfg.vaultAddress, source: cfg.sponsoredPubkey })
    )
    .setTimeout(cfg.txTimeoutSecs)
    .build();
}

export async function verifyTeardownOnChain(vaultBefore: VaultState): Promise<void> {
  console.log("\n=== On-chain verification ===");

  let stillExists = true;
  try {
    await loadAccountRecord(cfg.sponsoredPubkey);
  } catch (e) {
    if ((e as { response?: { status?: number } })?.response?.status === 404) stillExists = false;
    else throw e;
  }
  console.log(`Sponsored account ${cfg.sponsoredPubkey}`);
  console.log(
    stillExists ? "  still exists (expected it to be merged away)" : "  gone — merged into the vault"
  );

  const vaultAfter = await readVaultState();
  const releasedUnits = vaultBefore.numSponsoring - vaultAfter.numSponsoring;
  console.log(`\nSponsor vault ${cfg.vaultAddress}`);
  console.log(
    `  num_sponsoring: ${vaultBefore.numSponsoring} -> ${vaultAfter.numSponsoring} ` +
      `(-${releasedUnits} reserve units, expected -${SPONSORED_RESERVE_UNITS})`
  );
  console.log(`  XLM balance:    ${vaultBefore.balance} -> ${vaultAfter.balance}`);
  const account = await loadAccountRecord(cfg.vaultAddress);
  const minAfter =
    (2 + account.subentry_count + account.num_sponsoring - account.num_sponsored) * BASE_RESERVE_XLM;
  const minBefore = minAfter + releasedUnits * BASE_RESERVE_XLM;
  console.log(
    `  minimum balance: ${minBefore} -> ${minAfter} XLM ` +
      `(${releasedUnits * BASE_RESERVE_XLM} XLM freed — the balance barely moves, what changes is ` +
      `how much of it is spendable)`
  );
}

// ---------------------------------------------------------------------------
// Stuck-transaction handling
//
// Fordefi allocates the sequence number itself, taking the next one not already
// reserved by another of its transactions — empirically max(submitted, its own
// next free). A transaction that reaches `signed` under push_mode=manual holds
// its sequence whether or not it is ever broadcast, and nothing releases it
// automatically. So every abandoned attempt leaves a gap, and once the chain
// falls behind Fordefi's allocator every later transaction gets tx_bad_seq.
//
// Two consequences the scripts have to handle: refuse to submit a fresh
// transaction while a gap exists (it would just widen it), and let the caller
// broadcast the stuck transaction whose sequence the chain is actually waiting
// for.
// ---------------------------------------------------------------------------

async function fordefiGet<T>(path: string): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000);
  const response = await axios.get<T>(`${FORDEFI_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${fordefiConfig.accessToken}`,
      "x-signature": signFordefiApiPayload(fordefiConfig.apiPayloadSignKey, path, timestamp, ""),
      "x-timestamp": timestamp.toString(),
    },
    validateStatus: () => true,
  });
  const status = (response as { status: number }).status;
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status} on ${path}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

export interface PendingTx {
  id: string;
  createdAt: string;
  sequence: string;
  envelope: string;
  note?: string;
  maxTime?: string;
}

export async function chainSequence(): Promise<bigint> {
  const account = await loadAccountRecord(cfg.vaultAddress);
  return BigInt(account.sequence);
}

// Vault transactions sitting in `signed` — signed by Fordefi, never pushed, each
// still holding its sequence number.
export async function listStuckSignedTxs(): Promise<PendingTx[]> {
  const data = await fordefiGet<{ transactions?: StellarTransactionResponse[] }>(
    `${TRANSACTIONS_API_PATH}?vault_ids=${fordefiConfig.vaultId}&limit=100`
  );
  const records = data.transactions ?? [];
  const pending: PendingTx[] = [];

  for (const record of records) {
    if (record.state !== "signed") continue;
    const envelope = record.serialized_signed_transaction || record.raw_data;
    if (!envelope) continue;
    let tx: Transaction;
    try {
      tx = txFromXdr(envelope);
    } catch {
      continue; // not a plain Stellar transaction envelope
    }
    pending.push({
      id: record.id,
      createdAt: record.created_at ?? "",
      sequence: tx.sequence,
      envelope,
      note: record.note,
      maxTime: tx.timeBounds?.maxTime !== undefined ? String(tx.timeBounds.maxTime) : undefined,
    });
  }

  return pending.sort((a, b) => (BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1));
}

export function describeStuckTxs(pending: PendingTx[], chainSeq: bigint): void {
  const nextValid = chainSeq + 1n;
  const nowSecs = Math.floor(Date.now() / 1000);
  console.log(`On-chain sequence ${chainSeq} — the network will accept sequence ${nextValid} next.`);
  console.log(`Transactions stuck in \`signed\` on this vault: ${pending.length}`);
  for (const p of pending) {
    const seq = BigInt(p.sequence);
    const expired = p.maxTime && p.maxTime !== "0" && Number(p.maxTime) < nowSecs;
    const marker = expired
      ? "EXPIRED"
      : seq === nextValid
        ? "<= broadcastable now"
        : seq < nextValid
          ? "superseded"
          : `blocked (${seq - nextValid} ahead)`;
    console.log(`  seq=${p.sequence}  ${String(p.createdAt).slice(0, 19)}  ${p.id}  ${marker}`);
  }
}

export function logErrorAndExit(error: unknown): never {
  const e = error as { response?: { data?: unknown }; message?: string };
  if (e?.response?.data) {
    console.error("Horizon/API error:", JSON.stringify(e.response.data, null, 2));
  } else {
    console.error("Error:", e?.message ?? error);
  }
  process.exit(1);
}
