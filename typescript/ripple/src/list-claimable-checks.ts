import { fordefiConfig } from "./config.js";
import { describeCheck, findClaimableChecks } from "./lib.js";

async function main() {
  console.log("Looking for claimable checks:");
  console.log(`  Vault: ${fordefiConfig.vaultId}`);
  console.log(`  Chain: ${fordefiConfig.chain}`);
  console.log();

  const checks = await findClaimableChecks(fordefiConfig);

  if (checks.length === 0) {
    console.log("No claimable checks found for this vault.");
    console.log();
    console.log("Issued-token transfers arrive as checks only when the recipient has");
    console.log("no trust line for that currency yet — and only the recipient vault");
    console.log("can cash one, so check FORDEFI_RIPPLE_VAULT_ID is the payee.");
    return;
  }

  console.log(`Found ${checks.length} claimable check(s):`);
  checks.forEach((check, index) => {
    console.log();
    console.log(`  [${index + 1}]`);
    for (const line of describeCheck(check)) console.log(`    ${line}`);
  });

  console.log();
  console.log("To cash one, put its transaction ID in .env:");
  console.log(`  RIPPLE_CHECK_SOURCE_TX_ID=${checks[0]!.id}`);
  console.log("then run: npm run check:cash");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
