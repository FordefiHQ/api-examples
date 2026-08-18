import { fordefiConfig, xrpTransferConfig } from "./config.js";
import { assertBaseUnits, previewThenSubmit } from "./lib.js";
import { CreateRippleTransferRequest } from "../fordefi/index.js";

async function main() {
  // Base units, unscaled: native XRP has 6 decimals, so this is drops
  // (1 XRP = 1,000,000 drops). Scale in your own code if you work in XRP.
  const drops = assertBaseUnits(xrpTransferConfig.amountDrops, "RIPPLE_XRP_AMOUNT");

  const details: CreateRippleTransferRequest = {
    type: "ripple_transfer",
    push_mode: fordefiConfig.pushMode,
    asset_identifier: {
      type: "ripple",
      details: {
        type: "native",
        chain: fordefiConfig.chain,
      },
    },
    to: {
      type: "address",
      address: xrpTransferConfig.recipientAddress,
    },
    value: {
      type: "value",
      value: drops,
    },
    // Alternative: send to another Fordefi vault by id instead of an address.
    //
    // to: { type: "vault_id", vault_id: "<recipient vault uuid>" },
  };

  if (xrpTransferConfig.destinationTag) {
    details.tag = xrpTransferConfig.destinationTag;
  }

  console.log("XRP transfer:");
  console.log(`  Amount: ${drops} drops`);
  console.log(`  To:     ${xrpTransferConfig.recipientAddress}`);
  if (details.tag) console.log(`  Tag:    ${details.tag}`);
  console.log(`  Chain:  ${fordefiConfig.chain}`);
  console.log();

  await previewThenSubmit(
    fordefiConfig,
    details,
    `Transfer ${drops} drops to ${xrpTransferConfig.recipientAddress}`
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
