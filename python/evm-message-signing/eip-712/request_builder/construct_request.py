def construct_request(vault_id, data):
    
    print(f'Preparing transaction from Vault {vault_id}')

    request_json = {

        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "evm_message",
        "details": {
            "type": "typed_message_type",
            "raw_data": data,
            "chain": "ethereum_mainnet"
        },
        "vault_id": vault_id,
        "note": "Typed Data message, permit 1inch to spend USDC",
        "timeout": 15,
        "wait_for_state": "signed"
        
     }

    return request_json

def construct_tron_request(vault_id, data):
    
    print(f'Preparing transaction from Vault {vault_id}')

    request_json = {

        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "tron_message",
        "details": {
            "type": "typed_message_type",
            "raw_data": data,
            "chain": "tron_mainnet"
        },
        "vault_id": vault_id,
        "note": "Typed Data message, permit 1inch to spend USDC",
        "timeout": 15,
        "wait_for_state": "signed"
        
     }

    return request_json
