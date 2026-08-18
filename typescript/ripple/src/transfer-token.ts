import {
  fordefiConfig,
  tokenConfig,
  tokenRecipientAddress,
  tokenTransferAmount,
} from "./config.js";
import { assertBaseUnits, previewThenSubmit } from "./lib.js";
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
  // Base units, unscaled: `value` is exactly what the API sends to the ledger.
  // XRPL trust-line assets have 15 decimals, so "1" is 10^-15 of the token, not
  // one token — scale in your own code if you work in display amounts.
  const amount = assertBaseUnits(tokenTransferAmount(), "RIPPLE_TOKEN_AMOUNT");
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
    value: {
      type: "value",
      value: amount,
    },
  };

  console.log("Issued-token (IOU) transfer:");
  console.log(`  Amount:   ${amount} ${tokenConfig.currency} (base units)`);
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
