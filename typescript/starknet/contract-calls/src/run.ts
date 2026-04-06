import { fordefiConfig, contractCallConfig } from "./config.js";
import { CreateStarknetTransactionRequest, PushMode, submitContractCall } from "./fordefi/index.js";

async function main() {
  const request: CreateStarknetTransactionRequest = {
    vault_id: fordefiConfig.vaultId,
    signer_type: "api_signer",
    type: "starknet_transaction",
    details: {
      type: "starknet_contract_call",
      chain: fordefiConfig.chain,
      push_mode: fordefiConfig.pushMode as PushMode,
      call_data: [
        {
          to: contractCallConfig.contractAddress,
          method_name: contractCallConfig.methodName,
          method_arguments: contractCallConfig.methodArguments,
        },
      ],
    },
    note: `Contract call: ${contractCallConfig.methodName} on ${contractCallConfig.contractAddress}`,
  };

  console.log("Contract call config:");
  console.log(`  Contract: ${contractCallConfig.contractAddress}`);
  console.log(`  Method:   ${contractCallConfig.methodName}`);
  console.log(`  Args:     ${JSON.stringify(contractCallConfig.methodArguments)}`);
  console.log();

  const result = await submitContractCall(fordefiConfig, request);

  const txHash = result.starknet_transaction?.hash;
  console.log();
  console.log("Transaction completed!");
  console.log(`  State: ${result.state}`);
  if (txHash) {
    console.log(`  Hash:  ${txHash}`);
    console.log(`  View:  https://voyager.online/tx/${txHash}`);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
