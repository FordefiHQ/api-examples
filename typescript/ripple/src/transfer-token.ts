import {
  fordefiConfig,
  tokenConfig,
  tokenRecipientAddress,
  tokenTransferAmount,
} from "./config.js";
import { previewThenSubmit } from "./lib.js";
import { CreateRippleTransferRequest } from "../fordefi/index.js";

/**
 * Issued-token (IOU) transfer.
 *
 * If the recipient has no trust line for this currency, Fordefi delivers the
 * transfer as an XRPL Check instead of a settled payment, and the recipient must
 * cash it (see src/cash-check.ts). That is driven by the recipient's ledger
 * state, not by anything in this request — the API exposes no way to ask for a
 * check or to avoid one. The prediction below reports it as
 * `Claim status: claimable`.
 */
async function main() {
  const amount = tokenTransferAmount();
  const recipient = tokenRecipientAddress();

  const details: CreateRippleTransferRequest = {
    type: "ripple_transfer",
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
    to: {
      type: "address",
      address: recipient,
    },
    // Issued-token amounts are in the token's own units, not drops. Check the
    // predicted transfer effect printed below.
    value: {
      type: "value",
      value: amount,
    },
  };

  console.log("Issued-token (IOU) transfer:");
  console.log(`  Amount:   ${amount} ${tokenConfig.currency}`);
  console.log(`  Issuer:   ${tokenConfig.issuerAddress}`);
  console.log(`  To:       ${recipient}`);
  console.log(`  Chain:    ${fordefiConfig.chain}`);
  console.log();

  await previewThenSubmit(
    fordefiConfig,
    details,
    `Transfer ${amount} ${tokenConfig.currency} to ${recipient}`
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
