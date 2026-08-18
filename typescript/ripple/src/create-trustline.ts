import { fordefiConfig, tokenConfig } from "./config.js";
import { previewThenSubmit } from "./lib.js";
import { CreateRippleTrustlineRequest } from "../fordefi/index.js";

async function main() {
  const details: CreateRippleTrustlineRequest = {
    type: "ripple_create_trustline",
    push_mode: fordefiConfig.pushMode,
    asset_identifier: {
      type: "ripple",
      details: {
        type: "trust_line_asset",
        currency: tokenConfig.currency,
        issuer: {
          chain: fordefiConfig.chain,
          base58_repr: tokenConfig.issuerAddress,
        },
      },
    },
  };

  console.log("Trust line (TrustSet):");
  console.log(`  Currency: ${tokenConfig.currency}`);
  console.log(`  Issuer:   ${tokenConfig.issuerAddress}`);
  console.log(`  Chain:    ${fordefiConfig.chain}`);
  console.log("  Limit:    maximum (not configurable through this endpoint)");
  console.log();

  await previewThenSubmit(
    fordefiConfig,
    details,
    `Create trust line for ${tokenConfig.currency} (${tokenConfig.issuerAddress})`
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
