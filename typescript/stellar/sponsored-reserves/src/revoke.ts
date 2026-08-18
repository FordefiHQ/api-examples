import { fordefiConfig, sponsoredReservesConfig as cfg } from "./config.js";
import {
  CreateStellarTransactionRequest,
  submitTransaction,
} from "../../fordefi/index.js";
import {
  buildRevokeTx,
  describeOperations,
  explorerTxUrl,
  logErrorAndExit,
  readVaultState,
  reportLedgerResult,
  loadAccountRecord,
  nativeBalance,
} from "./lib.js";

// Revoke the sponsorship the vault is carrying for the sponsored account.
//
// RevokeSponsorship is signed by the sponsor alone, so unlike `npm run sponsor`
// this needs no second signature, no envelope recovery, and no manual push —
// Fordefi signs and broadcasts it in one step.
async function main(): Promise<void> {
  console.log("=== Revoke sponsorship ===");
  console.log(`Sponsor vault:     ${cfg.vaultAddress} (${fordefiConfig.vaultId})`);
  console.log(`Sponsored account: ${cfg.sponsoredPubkey}`);

  const vaultBefore = await readVaultState();
  const sponsoredBefore = await loadAccountRecord(cfg.sponsoredPubkey);
  const sponsoredXlm = nativeBalance(sponsoredBefore);
  console.log(`\nVault before:     XLM ${vaultBefore.balance}, num_sponsoring ${vaultBefore.numSponsoring}`);
  console.log(`Sponsored before: XLM ${sponsoredXlm}, num_sponsored ${sponsoredBefore.num_sponsored}`);

  // Revoking transfers the reserve obligation to the sponsored account. Say up
  // front whether it can carry it, so a REVOKE_SPONSORSHIP_LOW_RESERVE below is
  // an expected outcome rather than a mystery.
  const reserveAfterRevoke =
    (2 + sponsoredBefore.subentry_count + sponsoredBefore.num_sponsoring) * 0.5;
  if (parseFloat(sponsoredXlm) < reserveAfterRevoke) {
    console.log(
      `\nNote: once unsponsored, that account must hold ${reserveAfterRevoke} XLM to cover its own ` +
        `reserves; it holds ${sponsoredXlm}. Expect REVOKE_SPONSORSHIP_LOW_RESERVE.`
    );
  }

  console.log("\nBuilding revoke transaction...");
  const tx = await buildRevokeTx();
  describeOperations(tx).forEach((line) => console.log(line));

  const request: CreateStellarTransactionRequest = {
    vault_id: fordefiConfig.vaultId,
    signer_type: "api_signer",
    type: "stellar_transaction",
    details: {
      type: "stellar_raw_transaction",
      chain: fordefiConfig.chain,
      xdr_data: tx.toEnvelope().toXDR("base64"),
      // Only the sponsor signs, so there is nothing to attach afterwards —
      // Fordefi can broadcast this itself.
      push_mode: "auto",
      fail_on_prediction_failure: false,
    },
    note: `Revoke sponsorship of ${cfg.sponsoredPubkey} (${cfg.asset.getCode()} trustline + account)`,
  };

  console.log("\nSubmitting via Fordefi (push_mode=auto)...");
  const result = await submitTransaction(fordefiConfig, request, {
    maxAttempts: 60,
    pollIntervalMs: 2000,
  });
  console.log(`  state: ${result.state}`);
  if (result.hash) console.log(`  hash:  ${result.hash}\n  explorer: ${explorerTxUrl(result.hash)}`);

  const succeeded = result.hash ? await reportLedgerResult(result.hash) : false;

  const vaultAfter = await readVaultState();
  console.log(`\nVault after: XLM ${vaultAfter.balance}, num_sponsoring ${vaultBefore.numSponsoring} -> ${vaultAfter.numSponsoring}`);

  if (succeeded) {
    console.log("\nSponsorship revoked. The reserve obligation now sits with the sponsored account.");
    console.log("Note this did NOT return XLM to the vault — it only stopped the vault carrying it.");
  } else {
    console.log(
      "\nRevoke did not apply. To actually return the 1.5 XLM to the vault, remove the entries " +
        "instead: ChangeTrust to limit 0, then AccountMerge into the vault (both sourced by the " +
        "sponsored account, so that route needs its signature)."
    );
  }
}

main().catch(logErrorAndExit);
