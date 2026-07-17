import {
  Horizon,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";
import { fordefiConfig, tokenPaymentConfig } from "./config.js";
import { CreateStellarTransactionRequest, submitTransaction } from "../../fordefi/index.js";

async function buildPaymentXdr(): Promise<string> {
  const server = new Horizon.Server(tokenPaymentConfig.horizonUrl);
  const account = await server.loadAccount(tokenPaymentConfig.vaultAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(
      Operation.payment({
        destination: tokenPaymentConfig.destination,
        asset: new Asset(tokenPaymentConfig.assetCode, tokenPaymentConfig.assetIssuer),
        amount: tokenPaymentConfig.amount,
      })
    )
    .setTimeout(180)
    .build();

  return tx.toEnvelope().toXDR("base64");
}

async function main() {
  console.log("Raw transaction config:");
  console.log(`  Source:      ${tokenPaymentConfig.vaultAddress}`);
  console.log(`  Destination: ${tokenPaymentConfig.destination}`);
  console.log(`  Amount:      ${tokenPaymentConfig.amount} ${tokenPaymentConfig.assetCode}`);
  console.log(`  Asset:       ${tokenPaymentConfig.assetCode} (issuer ${tokenPaymentConfig.assetIssuer})`);
  console.log(`  Horizon:     ${tokenPaymentConfig.horizonUrl}`);
  console.log();

  console.log("Building unsigned XDR locally...");
  const xdr = await buildPaymentXdr();
  console.log(`XDR (${xdr.length} chars): ${xdr.slice(0, 80)}...`);
  console.log();

  const request: CreateStellarTransactionRequest = {
    vault_id: fordefiConfig.vaultId,
    signer_type: "api_signer",
    type: "stellar_transaction",
    details: {
      type: "stellar_raw_transaction",
      chain: fordefiConfig.chain,
      push_mode: fordefiConfig.pushMode,
      xdr_data: xdr,
    },
    note: `Raw payment of ${tokenPaymentConfig.amount} ${tokenPaymentConfig.assetCode} to ${tokenPaymentConfig.destination}`,
  };

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
