import { fordefiConfig, sponsoredReservesConfig as cfg } from "./config.js";
import {
  EXPECTED_LOCKED_XLM,
  attachSponsoredSignature,
  broadcastToHorizon,
  buildSponsorshipTx,
  describeOperations,
  diffEnvelopes,
  explorerTxUrl,
  loadSponsoredKeypair,
  logErrorAndExit,
  readVaultState,
  signWithFordefi,
  txFromXdr,
  verifyOnChain,
  chainSequence,
  describeStuckTxs,
  listStuckSignedTxs,
} from "./lib.js";

async function main(): Promise<void> {
  console.log("=== Stellar sponsored reserves via Fordefi ===");
  console.log(`Sponsor vault:     ${cfg.vaultAddress} (${fordefiConfig.vaultId})`);
  console.log(`Sponsored account: ${cfg.sponsoredPubkey}`);
  console.log(`Trustline asset:   ${cfg.asset.getCode()}:${cfg.asset.getIssuer()}`);
  console.log(`Chain:             ${fordefiConfig.chain}`);

  // 1. Vault state before, so the reserve accounting at the end is measured, not asserted.
  const vaultBefore = await readVaultState();
  console.log("\nSponsor vault before:");
  console.log(`  XLM balance:    ${vaultBefore.balance}`);
  console.log(`  num_sponsoring: ${vaultBefore.numSponsoring}`);
  console.log(`  subentries:     ${vaultBefore.subentryCount}`);
  console.log(`  this run will lock a further ${EXPECTED_LOCKED_XLM} XLM as sponsored reserves`);

  // 2. Refuse to submit while earlier transactions still hold sequence numbers.
  //    Fordefi hands out the next sequence not already reserved by one of its own
  //    transactions, so submitting now would be assigned a sequence beyond what
  //    the chain will accept — failing with tx_bad_seq and widening the gap by one.
  const chainSeq = await chainSequence();
  const stuck = await listStuckSignedTxs();
  if (stuck.length > 0) {
    console.log();
    describeStuckTxs(stuck, chainSeq);
    throw new Error(
      `${stuck.length} transaction(s) on this vault are stuck in \`signed\` and still hold their sequence numbers.\n` +
        `  These cannot be aborted — the API rejects aborting anything past \`approved\`. The only way to\n` +
        `  clear them is to broadcast them to Horizon in ascending sequence order, starting from the one\n` +
        `  matching the chain's next sequence; a transaction that fails on-chain still consumes its\n` +
        `  sequence, which is enough to close the gap.`
    );
  }

  // 3. Build the Begin/CreateAccount/ChangeTrust/End sandwich.
  console.log("\nBuilding sponsorship sandwich...");
  const tx = await buildSponsorshipTx();
  describeOperations(tx).forEach((line) => console.log(line));
  const submittedXdr = tx.toEnvelope().toXDR("base64");

  // 4. Vault signs, manual push — we get the envelope back instead of a broadcast.
  console.log();
  const returnedXdr = await signWithFordefi(
    submittedXdr,
    `Sponsor reserves for ${cfg.sponsoredPubkey} (account + ${cfg.asset.getCode()} trustline)`
  );

  // 5. Confirm Fordefi's rebuild left the sandwich structurally intact.
  diffEnvelopes(submittedXdr, returnedXdr);

  // 6. Attach the sponsored account's signature to Fordefi's envelope.
  const signedTx = txFromXdr(returnedXdr);
  attachSponsoredSignature(signedTx, loadSponsoredKeypair());
  if (signedTx.signatures.length !== 2) {
    throw new Error(
      `Expected 2 signatures before broadcast (vault + sponsored account), got ${signedTx.signatures.length}`
    );
  }
  console.log(`\nEnvelope now carries ${signedTx.signatures.length} signatures (vault + sponsored account).`);

  // 7. Broadcast ourselves — Fordefi never saw the complete envelope.
  console.log("Submitting to Horizon...");
  const hash = await broadcastToHorizon(signedTx);
  console.log(`  hash:     ${hash}`);
  console.log(`  explorer: ${explorerTxUrl(hash)}`);

  // 8. Prove it did what we claimed.
  await verifyOnChain(vaultBefore);

  console.log("\nDone.");
}

main().catch(logErrorAndExit);
