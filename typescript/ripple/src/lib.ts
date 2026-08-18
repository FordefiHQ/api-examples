import {
  CreateRippleTransactionRequest,
  FordefiRippleConfig,
  PredictRippleTransactionRequest,
  PredictedRippleTransaction,
  RippleTransaction,
  RippleTransactionDetails,
  RippleTransactionResult,
  describeOutcome,
  listTransactions,
  predictTransaction,
  submitTransaction,
} from "../fordefi/index.js";

export const DROPS_PER_XRP = 1_000_000;
const XRP_DECIMALS = 6;

/**
 * Converts an XRP amount to an integer drops string without going through
 * floating point (0.1 XRP must be exactly 100000 drops).
 */
export function xrpToDrops(amountXrp: string): string {
  const trimmed = amountXrp.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid XRP amount: "${amountXrp}"`);
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > XRP_DECIMALS) {
    throw new Error(
      `XRP amounts support at most ${XRP_DECIMALS} decimal places (1 drop), got "${amountXrp}"`
    );
  }

  const drops = `${whole}${fraction.padEnd(XRP_DECIMALS, "0")}`.replace(/^0+(?=\d)/, "");
  if (drops === "0") throw new Error("Amount must be greater than zero");
  return drops;
}

export function dropsToXrp(drops: string): string {
  const padded = drops.padStart(XRP_DECIMALS + 1, "0");
  const whole = padded.slice(0, -XRP_DECIMALS);
  const fraction = padded.slice(-XRP_DECIMALS).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
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
    const symbol = transfer.priced_asset?.symbol ?? "";
    console.log(
      `  Transfer:  ${transfer.amount} ${symbol} ${transfer.from.address} -> ${transfer.to.address}`
    );
  }

  for (const change of result.effects.balance_changes ?? []) {
    const symbol = change.priced_asset?.symbol ?? "";
    console.log(`  Balance:   ${change.address.address} ${change.diff} ${symbol}`);
  }

  for (const change of result.effects.trustline_changes ?? []) {
    const symbol = change.priced_asset?.symbol ?? "";
    console.log(`  Trustline: ${change.address.address} limit ${change.limit} ${symbol}`);
  }

  if (result.fee?.fee_charged) console.log(`  Fee:       ${result.fee.fee_charged}`);
  if (result.trustline_fee?.fee_charged) {
    console.log(`  Trustline fee: ${result.trustline_fee.fee_charged}`);
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
 */
export async function findClaimableChecks(
  config: FordefiRippleConfig
): Promise<RippleTransaction[]> {
  const response = await listTransactions(config, {
    vault_ids: [config.vaultId],
    chains: [config.chain],
    direction: "incoming",
    claimed: false,
    size: 50,
  });

  return response.transactions.filter(
    (transaction) => transaction.claim_status === "claimable" && Boolean(transaction.check_id)
  );
}

export function describeCheck(transaction: RippleTransaction): string[] {
  const transfer = transaction.expected_result?.effects?.transfers?.[0];
  const amount = transfer
    ? `${transfer.amount} ${transfer.priced_asset?.symbol ?? ""}`.trim()
    : "(amount unavailable)";

  return [
    `Transaction ID: ${transaction.id}`,
    `Check ID:       ${transaction.check_id}`,
    `From:           ${transfer?.from.address ?? transaction.sender?.address ?? "(unknown)"}`,
    `Amount:         ${amount}`,
    `Created:        ${transaction.created_at ?? "(unknown)"}`,
    `State:          ${transaction.state}`,
  ];
}
