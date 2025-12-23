import { FordefiConfig, TxParams } from "./config.js"; 

export async function createRequest(fordefiConfig: FordefiConfig, txParams: TxParams, hex_call_data: string) {    
  const requestJson =  {
      "vault_id": fordefiConfig.vaultId,
      "note": "string",
      "signer_type": "api_signer",
      "sign_mode": "auto",
      "type": "evm_transaction",
      "details": {
        "type": "evm_raw_transaction",
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
        // "custom_nonce": txParams.custom_nonce,
        "chain": `evm_${txParams.evmChain}`,
        "to": txParams.to,
        "value": txParams.amount,
        "data": {
          "type": "hex",
          "hex_data": hex_call_data
        }
      }
    };

    return requestJson;
}
