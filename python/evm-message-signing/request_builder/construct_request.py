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
        "timeout": 45,
        "wait_for_state": "signed"
        
     }

    return request_json

def construct_personal_message_request(vault_id: str, message: str, chain: str) -> dict:
    print(f'Preparing personal message signing from Vault {vault_id}')
    print(f'Chain: {chain}')
    hex_encoded_message = '0x' + message.encode('utf-8').hex()

    request_json = {
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "evm_message",
        "details": {
            "type": "personal_message_type",
            "raw_data": hex_encoded_message,
            "chain": chain
        },
        "vault_id": vault_id,
        "wait_for_state": "signed",
        "timeout": 45
    }

    return request_json
