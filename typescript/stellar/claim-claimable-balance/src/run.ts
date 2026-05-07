import { fordefiConfig, claimByAssetConfig } from "./config.js";
import {
  ClaimClaimableBalanceSource,
  CreateStellarTransactionRequest,
  submitTransaction,
} from "../../fordefi/index.js";

async function main() {
  // Default: claim all claimable balances of a given classic asset.
  const source: ClaimClaimableBalanceSource = {
    type: "by_asset",
    asset_identifier: {
      type: "stellar",
      details: {
        type: "classic_asset",
        chain: fordefiConfig.chain,
        code: claimByAssetConfig.assetCode,
        issuer: {
          chain: fordefiConfig.chain,
          base32_repr: claimByAssetConfig.assetIssuer,
        },
      },
    },
  };

  // Alternative: claim balances tied to a specific Fordefi incoming transaction.
  // Set STELLAR_INCOMING_TX_ID in .env, import incomingTxId from ./config.js,
  // and replace the `source` above with:
  //
  // const source: ClaimClaimableBalanceSource = {
  //   type: "by_transaction",
  //   transaction_id: incomingTxId!,
  // };

  const request: CreateStellarTransactionRequest = {
    vault_id: fordefiConfig.vaultId,
    signer_type: "api_signer",
    type: "stellar_transaction",
    details: {
      type: "stellar_claim_claimable_balance",
      push_mode: fordefiConfig.pushMode,
      source,
    },
    note: `Claim claimable balances for ${claimByAssetConfig.assetCode}`,
  };

  console.log("Claim config:");
  console.log(`  Mode:   by_asset`);
  console.log(`  Code:   ${claimByAssetConfig.assetCode}`);
  console.log(`  Issuer: ${claimByAssetConfig.assetIssuer}`);
  console.log();

  const result = await submitTransaction(fordefiConfig, request);

  console.log();
  console.log("Transaction completed!");
  console.log(`  State: ${result.state}`);
  if (result.hash) console.log(`  Hash:  ${result.hash}`);
  if (result.explorer_url) console.log(`  View:  ${result.explorer_url}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
