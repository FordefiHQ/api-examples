import { fordefiConfig, messageConfig } from "./config.js";
import { CreateStellarMessageRequest, submitTransaction } from "../../fordefi/index.js";

const HEX_PATTERN = /^0[xX][a-fA-F0-9]+$/;

function toHexRawData(): string {
  if (messageConfig.messageHex) {
    if (!HEX_PATTERN.test(messageConfig.messageHex)) {
      throw new Error("STELLAR_MESSAGE_HEX must match ^0[xX][a-fA-F0-9]+$");
    }
    return messageConfig.messageHex;
  }
  if (!messageConfig.message) {
    throw new Error("Set either STELLAR_MESSAGE or STELLAR_MESSAGE_HEX");
  }
  return "0x" + Buffer.from(messageConfig.message, "utf8").toString("hex");
}

async function main() {
  const rawData = toHexRawData();

  const request: CreateStellarMessageRequest = {
    vault_id: fordefiConfig.vaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "stellar_message",
    details: {
      chain: fordefiConfig.chain,
      raw_data: rawData,
    },
    note: messageConfig.message
      ? `Sign message: ${messageConfig.message}`
      : `Sign message (hex): ${rawData.slice(0, 40)}...`,
  };

  console.log("Sign message config:");
  if (messageConfig.message) console.log(`  Message:  ${messageConfig.message}`);
  console.log(`  Raw data: ${rawData}`);
  console.log(`  Chain:    ${fordefiConfig.chain}`);
  console.log();

  const result = await submitTransaction(fordefiConfig, request);

  console.log();
  console.log("Message signed!");
  console.log(`  ID:    ${result.id}`);
  console.log(`  State: ${result.state}`);
  if (result.signatures && result.signatures.length > 0) {
    result.signatures.forEach((sig, i) => {
      console.log(`  Signature[${i}]: ${sig.data}`);
    });
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
