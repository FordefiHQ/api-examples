import {
  CreateRippleTransactionRequest,
  FordefiRippleConfig,
  ListTransactionsQuery,
  PredictRippleTransactionRequest,
  PredictedRippleTransaction,
  RippleTransaction,
  RippleTransactionDetails,
  RippleTransactionResult,
  describeOutcome,
  formatAmount,
  formatLimit,
  listTransactions,
  predictTransaction,
  submitTransaction,
} from "../fordefi/index.js";

/**
 * Validates an amount that is already in base units. Token recipes pass amounts
 * straight through to the API rather than scaling them, so this only enforces
 * what the API's own `^\d+$` schema requires — catching a decimal amount here
 * gives a better message than a 422, and a bare "1" is a valid (if tiny) amount,
 * not something to second-guess.
 */
export function assertBaseUnits(value: string, label = "amount"): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `${label} must be an integer in the asset's base units, got "${value}". ` +
        `Native XRP has 6 decimals (1 XRP = "1000000" drops); XRPL trust-line ` +
        `assets have 15 (1 USDC = "1000000000000000").`
    );
  }
  if (/^0+$/.test(trimmed)) throw new Error(`${label} must be greater than zero`);
  return trimmed;
}

/** Write recipes send by default; `--dry-run` (or DRY_RUN=1) stops after the prediction. */
export function isDryRun(): boolean {
  return process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
}

function printResult(label: string, result: RippleTransactionResult | undefined): void {
  if (!result) {
    console.log(`  ${label}: (none returned)`);
    return;
  }

  for (const transfer of result.effects.transfers ?? []) {
    console.log(
      `  Transfer:  ${formatAmount(transfer.amount, transfer.priced_asset)} ` +
        `${transfer.from.address} -> ${transfer.to.address}`
    );
  }

  for (const change of result.effects.balance_changes ?? []) {
    console.log(
      `  Balance:   ${change.address.address} ${formatAmount(change.diff, change.priced_asset)}`
    );
  }

  for (const change of result.effects.trustline_changes ?? []) {
    console.log(
      `  Trustline: ${change.address.address} limit ${formatLimit(change.limit, change.priced_asset)}`
    );
  }

  if (result.fee?.fee_charged) {
    console.log(`  Fee:       ${formatAmount(result.fee.fee_charged, result.fee.priced_asset)}`);
  }
  if (result.trustline_fee?.fee_charged) {
    console.log(
      `  Trustline fee: ${formatAmount(result.trustline_fee.fee_charged, result.trustline_fee.priced_asset)}`
    );
  }
  if (result.reversion && result.reversion.state !== "not_reverted") {
    console.log(
      `  Reversion: ${result.reversion.state}${result.reversion.reason ? ` - ${result.reversion.reason}` : ""}`
    );
  }
}

function printPrediction(prediction: PredictedRippleTransaction): void {
  console.log("Prediction:");
  console.log(`  Sender:    ${prediction.sender?.address ?? "(unknown)"}`);
  if (prediction.ripple_transaction_type_details) {
    console.log(`  Operation: ${prediction.ripple_transaction_type_details.type}`);
  }
  if (prediction.claim_status) {
    console.log(`  Claim status: ${prediction.claim_status}`);
  }
  printResult("Expected result", prediction.expected_result);
  const simulation = prediction.simulation_status_result;
  if (simulation?.simulation_status) {
    console.log(
      `  Simulation: ${simulation.simulation_status}${simulation.details ? ` - ${simulation.details}` : ""}`
    );
  }
}

/**
 * The shape every write recipe shares: predict first, print what would happen,
 * then create the transaction unless the run asked for a dry run.
 */
export async function previewThenSubmit(
  config: FordefiRippleConfig,
  details: RippleTransactionDetails,
  note: string
): Promise<RippleTransaction | undefined> {
  const predictRequest: PredictRippleTransactionRequest = {
    vault_id: config.vaultId,
    type: "ripple_transaction",
    details,
    note,
  };

  printPrediction(await predictTransaction(config, predictRequest));
  console.log();

  if (isDryRun()) {
    console.log("Dry run only — no transaction was created.");
    console.log("Re-run without --dry-run to sign and broadcast it.");
    return undefined;
  }

  const request: CreateRippleTransactionRequest = {
    vault_id: config.vaultId,
    type: "ripple_transaction",
    details,
    signer_type: "api_signer",
    note,
  };

  const result = await submitTransaction(config, request);

  console.log();
  console.log("Transaction completed!");
  for (const line of describeOutcome(result)) console.log(`  ${line}`);
  return result;
}

/**
 * Inbound XRPL trust-line transfers to a vault without the matching trust line
 * are delivered as Checks. Fordefi records them with `claim_status: "claimable"`
 * and a `check_id`; the transaction's own UUID is what `ripple_cash_check` needs.
 *
 * Both filters that look like they belong on this query are deliberately absent:
 *
 * - `direction: "incoming"` is wrong whenever the sender is another vault in the
 *   same organization. Fordefi labels direction per organization, not per vault,
 *   so a check written from vault A to vault B is `outgoing` on both — filtering
 *   on `incoming` hides exactly the internal transfers used to test this flow.
 * - `claimed: false` does not cover Ripple. The parameter is real and documented
 *   for Stellar claimable balances and Canton transfers, but for `ripple_*`
 *   chains both `true` and `false` match nothing, so passing it returns an empty
 *   page even when a claimable check exists.
 *
 * So the claim state is filtered here instead, which makes paging mandatory: the
 * server no longer narrows the result set, and a busy vault can push checks past
 * the first page.
 */
export async function findClaimableChecks(
  config: FordefiRippleConfig
): Promise<RippleTransaction[]> {
  const transactions = await listAllTransactions(config, {
    vault_ids: [config.vaultId],
    chains: [config.chain],
  });

  return transactions.filter((transaction) => isCashableCheck(transaction, config.vaultId));
}

/**
 * A check is cashable by this vault only if the vault is the *recipient*. Because
 * `vault_ids` matches transactions the vault signed as well as ones it merely
 * interacted with, an internal transfer comes back for the sending vault too —
 * and the sender cannot cash its own check (there is no `CheckCancel` either).
 * `recipient.vault` is populated for external senders as well, so this one test
 * covers both cases.
 */
function isCashableCheck(transaction: RippleTransaction, vaultId: string): boolean {
  if (transaction.claim_status !== "claimable" || !transaction.check_id) return false;
  return transaction.ripple_transaction_type_details?.recipient?.vault?.id === vaultId;
}

/** `GET /transactions` is paginated (100 per page max), so walk every page. */
async function listAllTransactions(
  config: FordefiRippleConfig,
  query: Omit<ListTransactionsQuery, "page" | "size">
): Promise<RippleTransaction[]> {
  const size = 100;
  const transactions: RippleTransaction[] = [];

  for (let page = 1; ; page++) {
    const response = await listTransactions(config, { ...query, page, size });
    transactions.push(...response.transactions);

    if (response.transactions.length < size || transactions.length >= response.total) {
      return transactions;
    }
  }
}

/**
 * Only `POST /transactions/predict` returns `expected_result`; the listing and
 * read endpoints do not, and a claimable check has no mined effects yet (its
 * value moves at `CheckCash` time). There is therefore no amount to show here —
 * print the identifying fields the API does return instead of a blank amount.
 */
export function describeCheck(transaction: RippleTransaction): string[] {
  const details = transaction.ripple_transaction_type_details;
  const sender =
    details && "sender" in details ? details.sender?.address : transaction.sender?.address;

  const lines = [
    `Transaction ID: ${transaction.id}`,
    `Check ID:       ${transaction.check_id}`,
    `From:           ${sender ?? "(unknown)"}`,
    `To:             ${details?.recipient?.address ?? "(unknown)"} (${details?.recipient?.vault?.name ?? "this vault"})`,
    `Created:        ${transaction.created_at ?? "(unknown)"}`,
    `State:          ${transaction.state}`,
  ];

  // Sender-authored free text: it often names the amount, but it is a hint rather
  // than a value read from the ledger.
  if (transaction.note) lines.push(`Note:           ${transaction.note}`);
  if (transaction.explorer_url) lines.push(`Explorer:       ${transaction.explorer_url}`);

  return lines;
}
