import { checkSourceTransactionId, fordefiConfig } from "./config.js";
import { describeCheck, findClaimableChecks, previewThenSubmit } from "./lib.js";
import { CreateRippleCashCheckRequest, RippleTransaction } from "../fordefi/index.js";

async function resolveSourceTransactionId(): Promise<string> {
  if (checkSourceTransactionId) return checkSourceTransactionId;

  console.log("RIPPLE_CHECK_SOURCE_TX_ID is not set — searching for claimable checks...");
  const checks: RippleTransaction[] = await findClaimableChecks(fordefiConfig);

  if (checks.length === 0) {
    throw new Error(
      "No claimable checks found for this vault. Run `npm run checks:list` to inspect."
    );
  }

  if (checks.length > 1) {
    throw new Error(
      `Found ${checks.length} claimable checks. Set RIPPLE_CHECK_SOURCE_TX_ID to pick one ` +
        `(run \`npm run checks:list\` to see them).`
    );
  }

  const check = checks[0]!;
  console.log("Auto-selected the only claimable check:");
  for (const line of describeCheck(check)) console.log(`  ${line}`);
  console.log();

  return check.id;
}

async function main() {
  const transactionId = await resolveSourceTransactionId();

  const details: CreateRippleCashCheckRequest = {
    type: "ripple_cash_check",
    push_mode: fordefiConfig.pushMode,
    transaction_id: transactionId,
  };

  console.log("Cash check (CheckCash):");
  console.log(`  Source transaction: ${transactionId}`);
  console.log(`  Chain:              ${fordefiConfig.chain}`);
  console.log("  Fordefi pushes a TrustSet first if the vault has no trust line yet.");
  console.log();

  await previewThenSubmit(
    fordefiConfig,
    details,
    `Cash check from transaction ${transactionId}`
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
