import { FordefiConfig, TxParams } from "../config"; 

export async function createRequest(fordefiConfig: FordefiConfig, txParams: TxParams) {    
  const requestJson =  {
      "vault_id": fordefiConfig.vaultId,
      "note": "string",
      "signer_type": "api_signer",
      "sign_mode": "auto",
      "type": "evm_transaction",
      "details": {
        "type": "evm_raw_transaction",
        "use_secure_node": txParams.use_secure_node,
        "gas": {
            "gas_limit": txParams.gas_limit,
            "type": "custom",
            "details": {
                "type": "dynamic",
                "max_fee_per_gas": txParams.max_fee_per_gas, 
                "max_priority_fee_per_gas": txParams.max_priority_fee_per_gas
            }
        },
        "skip_prediction": false,
        "push_mode": "auto",
        //"funder": "c3317b70-0509-41f8-be1e-e7c91e42281f", //OPTIONAL -> designates a different vault to be the gas payer for the transaction
        "chain": `${txParams.evmChain}_mainnet`,
        "to": txParams.to,
        "value": txParams.amount
      }
    };

    return requestJson;
}
