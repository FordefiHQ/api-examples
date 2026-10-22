import fs from 'fs';
import { FordefiConfig, DeployParams } from "../config";

function loadBytecode(artifactPath: string): string {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const bytecode: string | undefined = artifact.bytecode?.object;
  if (!bytecode || bytecode === "0x") {
    throw new Error(`No bytecode found in ${artifactPath}. Run \`forge build\` first.`);
  }
  return bytecode;
}

export async function createRequest(fordefiConfig: FordefiConfig, deployParams: DeployParams) {
  const requestJson = {
      "vault_id": fordefiConfig.vaultId,
      "note": "Deploy Counter.sol",
      "signer_type": "api_signer",
      "sign_mode": "auto",
      "type": "evm_transaction",
      "details": {
        "type": "evm_raw_transaction",
        "chain": `${deployParams.evmChain}_mainnet`,
        // no "to" field -> contract creation
        "value": "0",
        "data": {
          "type": "hex",
          "hex_data": loadBytecode(deployParams.artifactPath)
        },
        "custom_nonce": deployParams.custom_nonce,
        "gas": {
            "gas_limit": deployParams.gas_limit,
            "type": "custom",
            "details": {
                "type": "dynamic",
                "max_fee_per_gas": deployParams.max_fee_per_gas,
                "max_priority_fee_per_gas": deployParams.max_priority_fee_per_gas
            }
        },
        "skip_prediction": false,
        "push_mode": "auto"
      }
    };

    return requestJson;
}
