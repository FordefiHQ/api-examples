import { fordefiConfig, sponsoredReservesConfig as cfg } from "./config.js";
import {
  attachSponsoredSignature,
  broadcastToHorizon,
  buildMergeTx,
  chainSequence,
  describeOperations,
  describeStuckTxs,
  diffEnvelopes,
  explorerTxUrl,
  listStuckSignedTxs,
  loadAccountRecord,
  loadSponsoredKeypair,
  logErrorAndExit,
  nativeBalance,
  readVaultState,
  signWithFordefi,
  txFromXdr,
  verifyTeardownOnChain,
} from "./lib.js";

// Unwind the sponsorship and return the reserves to the vault.
//
// This is NOT a revoke. Revoking moves the reserve obligation onto the sponsored
// account, which then has to fund itself; removing the entries ends the
// sponsorship and hands the reserve back to the sponsor. Removal is what gets the
// XLM back, and it needs no funding.
//
// Destructive but not permanent. AccountMerge deletes the account ENTRY, not the
// keypair: the same address can be recreated later with CreateAccount, and comes
// back with a sequence number derived from the current ledger, so envelopes signed
// for the previous incarnation cannot be replayed. Verified here — this project's
// sponsored account was merged and then re-created from the same
// SPONSORED_ED25519_SECRET.
//
// What is actually lost is the account's configuration: the trustline goes with
// it and has to be re-established (and re-sponsored) if the address is revived,
// along with any signers, offers or data entries. Payments sent to the address
// while no account exists fail with op_no_destination rather than vanishing.
async function main(): Promise<void> {
  console.log("=== Merge away the sponsored account (reclaim reserves) ===");
  console.log(`Sponsor vault:     ${cfg.vaultAddress} (${fordefiConfig.vaultId})`);
  console.log(`Sponsored account: ${cfg.sponsoredPubkey}  <- entry will be deleted (address is recreatable)`);

  const sponsored = await loadAccountRecord(cfg.sponsoredPubkey);
  const trustlines = sponsored.balances.filter((b) => b.asset_type !== "native");
  console.log(`\nSponsored account holds:`);
  console.log(`  XLM ${nativeBalance(sponsored)}`);
  trustlines.forEach((b) =>
    console.log(`  ${(b as { asset_code?: string }).asset_code} ${b.balance}`)
  );

  // AccountMerge refuses while any subentry remains, and ChangeTrust to limit 0
  // refuses while the trustline holds a balance. Say so before the ledger does.
  const funded = trustlines.filter((b) => parseFloat(b.balance) > 0);
  if (funded.length > 0) {
    throw new Error(
      `The sponsored account still holds a balance on ${funded
        .map((b) => (b as { asset_code?: string }).asset_code)
        .join(", ")}. ChangeTrust to limit 0 is rejected while the trustline holds tokens ` +
        "(the limit would sit below the balance), so this transaction would fail. Move the tokens " +
        "out first."
    );
  }
  const extra = trustlines.filter(
    (b) =>
      (b as { asset_code?: string }).asset_code !== cfg.asset.getCode() ||
      (b as { asset_issuer?: string }).asset_issuer !== cfg.asset.getIssuer()
  );
  if (extra.length > 0) {
    throw new Error(
      `The sponsored account has trustlines this script does not remove: ${extra
        .map((b) => (b as { asset_code?: string }).asset_code)
        .join(", ")}. AccountMerge fails while any subentry remains.`
    );
  }

  const vaultBefore = await readVaultState();
  console.log(`\nVault before: XLM ${vaultBefore.balance}, num_sponsoring ${vaultBefore.numSponsoring}`);

  const chainSeq = await chainSequence();
  const stuck = await listStuckSignedTxs();
  if (stuck.length > 0) {
    console.log();
    describeStuckTxs(stuck, chainSeq);
    throw new Error(
      `${stuck.length} transaction(s) on this vault are stuck in \`signed\` and still hold their ` +
        "sequence numbers. Broadcast them in ascending sequence order to clear the gap, then re-run."
    );
  }

  console.log("\nBuilding teardown transaction...");
  const tx = await buildMergeTx();
  describeOperations(tx).forEach((line) => console.log(line));
  const submittedXdr = tx.toEnvelope().toXDR("base64");

  console.log();
  const returnedXdr = await signWithFordefi(
    submittedXdr,
    `Remove ${cfg.asset.getCode()} trustline and merge ${cfg.sponsoredPubkey} into the vault`
  );

  diffEnvelopes(submittedXdr, returnedXdr);

  const signedTx = txFromXdr(returnedXdr);
  attachSponsoredSignature(signedTx, loadSponsoredKeypair());
  if (signedTx.signatures.length !== 2) {
    throw new Error(
      `Expected 2 signatures before broadcast (vault + sponsored account), got ${signedTx.signatures.length}`
    );
  }
  console.log(`\nEnvelope now carries ${signedTx.signatures.length} signatures.`);

  console.log("Submitting to Horizon...");
  const hash = await broadcastToHorizon(signedTx);
  console.log(`  hash:     ${hash}`);
  console.log(`  explorer: ${explorerTxUrl(hash)}`);

  await verifyTeardownOnChain(vaultBefore);

  console.log("\nDone.");
}

main().catch(logErrorAndExit);
