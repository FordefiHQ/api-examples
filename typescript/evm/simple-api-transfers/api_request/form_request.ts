export async function createRequest(vault_id: string, evm_chain: string, to: string, amount: string) {
    
  const requestJson =  {
      "vault_id": vault_id,
      "note": "string",
      "signer_type": "api_signer",
      "sign_mode": "auto",
      "type": "evm_transaction",
      "details": {
        "type": "evm_raw_transaction",
        "use_secure_node": false,
        "gas": {
          "gas_limit": "21000",
          "type": "priority",
          "priority_level": "medium"
        },
        "fail_on_prediction_failure": true,
        "skip_prediction": false,
        "push_mode": "auto",
        //"funder": "c3317b70-0509-41f8-be1e-e7c91e42281f", //OPTIONAL -> designates a different vault to be the gas payer for the transaction
        "chain": `${evm_chain}_mainnet`,
        "to": to,
        "value": amount
      }
    };

    return requestJson;
}
