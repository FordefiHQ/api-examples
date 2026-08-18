import { fordefiConfig, xrpTransferConfig } from "./config.js";
import { previewThenSubmit, xrpToDrops } from "./lib.js";
import { CreateRippleTransferRequest } from "../fordefi/index.js";

async function main() {
  const drops = xrpToDrops(xrpTransferConfig.amountXrp);

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
    // Native XRP amounts are expressed in drops (1 XRP = 1,000,000 drops).
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
  console.log(`  Amount: ${xrpTransferConfig.amountXrp} XRP (${drops} drops)`);
  console.log(`  To:     ${xrpTransferConfig.recipientAddress}`);
  if (details.tag) console.log(`  Tag:    ${details.tag}`);
  console.log(`  Chain:  ${fordefiConfig.chain}`);
  console.log();

  await previewThenSubmit(
    fordefiConfig,
    details,
    `Transfer ${xrpTransferConfig.amountXrp} XRP to ${xrpTransferConfig.recipientAddress}`
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
