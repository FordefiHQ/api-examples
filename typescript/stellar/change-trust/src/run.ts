import { fordefiConfig, trustlineConfig } from "./config.js";
import { CreateStellarTransactionRequest, submitTransaction } from "../../fordefi/index.js";

async function main() {
  const request: CreateStellarTransactionRequest = {
    vault_id: fordefiConfig.vaultId,
    signer_type: "api_signer",
    type: "stellar_transaction",
    details: {
      type: "stellar_change_trust",
      push_mode: fordefiConfig.pushMode,
      asset_identifier: {
        type: "stellar",
        details: {
          type: "classic_asset",
          chain: fordefiConfig.chain,
          code: trustlineConfig.assetCode,
          issuer: {
            chain: fordefiConfig.chain,
            base32_repr: trustlineConfig.assetIssuer,
          },
        },
      },
    },
    note: `ChangeTrust: ${trustlineConfig.assetCode} (${trustlineConfig.assetIssuer})`,
  };

  console.log("Trustline config:");
  console.log(`  Code:   ${trustlineConfig.assetCode}`);
  console.log(`  Issuer: ${trustlineConfig.assetIssuer}`);
  console.log(`  Chain:  ${fordefiConfig.chain}`);
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
