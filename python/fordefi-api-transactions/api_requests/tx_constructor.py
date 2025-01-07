__all__ = ['evm_tx_native', 'sol_tx_native', 'sui_tx_native', 'ton_tx_native']

from dotenv import load_dotenv

load_dotenv()

def evm_tx_native(evm_chain, vault_id, destination, custom_note, value):

    print(f"⚙️ Preparing tx for {value} gwei!")

    """
    Native ETH transfer
    "580000000000000" wei = $2 USD of ETH

    """

    request_json = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": custom_note,
        "type": "evm_transaction",
        "details": {
            "type": "evm_transfer",
            "gas": {
                "type": "priority",
                "priority_level": "medium"
            },
            "to": destination,
            "asset_identifier": {
                "type": "evm",
                "details": {
                    "type": "native",
                    "chain": f"evm_{evm_chain}_mainnet"
                }
            },
            "value": {
                "type": "value",
                "value": value
            }
        }
    }
    
    return request_json


def sol_tx_native(vault_id, destination, custom_note, value):

    print(f"⚙️ Preparing transaction for {value} lamports!")

    request_json = {

    "signer_type": "api_signer",
    "type": "solana_transaction",
    "details": {
        "type": "solana_transfer",
        "to": destination,
        "value": {
            "type": "value",
            "value": value
        },
        "asset_identifier": {
            "type": "solana",
            "details": {
                "type": "native",
                "chain": "solana_mainnet"
            }
        }
    },
    "note": custom_note,
    "vault_id": vault_id
    }
    
    return request_json

def sui_tx_native(vault_id, destination, custom_note, value):

    print(f"⚙️ Preparing transaction to {destination} for {value} mist!")

    request_json = {

        "signer_type": "api_signer",
        "type": "sui_transaction",
        "details": {
                "type": "sui_transfer",
                "to": {
                    "type": "hex",
                    "address": destination
                },
                "value": {
                    "type": "value",
                    "value": value
                },
                "gas_config": {
                    "payment": []
                },
                "asset_identifier": {
                    "type": "sui",
                    "details": {
                        "type": "native",
                        "chain": "sui_mainnet"
                    }
                }
            },
        "note": custom_note,
        "vault_id": vault_id
    }

    return request_json

def ton_tx_native(vault_id, destination, custom_note, value):

    print(f"⚙️ Preparing transaction to {destination} for {value} nanotons!")

    request_json = {

        "vault_id": vault_id,
        "note": custom_note,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "ton_transaction",
        "details": {
            "type": "ton_transfer",
            "fail_on_prediction_failure": True,
            "push_mode": "auto",
            "to": {
                "type": "hex",
                "address": destination
            },
            "value": {
                "type": "value",
                "value": value
            },
            "asset_identifier": {
                "type": "ton",
                "details": {
                    "type": "native",
                    "chain": "ton_mainnet"
                }
            },
            "skip_prediction": False
        }
    }

    return request_json

def aptos_tx_native(vault_id, destination, custom_note, value):

    print(f"⚙️ Preparing transaction to {destination} for {value} octas!")

    request_json = {
        "vault_id": vault_id,
        "note": custom_note,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "aptos_transaction",
        "details": {
            "type": "aptos_transfer",
            "fail_on_prediction_failure": True,
            "gas_config": {
            "max_gas": "20000",
            "price": {
                "type": "custom",
                "price": "100"
            }
            },
            "to": {
            "type": "hex",
            "address": destination,
            },
            "value": {
            "type": "value",
            "value": value,
            },
            "asset_identifier": {
            "type": "aptos",
            "details": {
                "type": "native",
                "chain": "aptos_mainnet"
            }
            },
            "skip_prediction": False,
            "push_mode": "auto"
        }
        }

    return request_json

def btc_tx_native(vault_id, destination, custom_note, value):

    request_json = {
        "vault_id": vault_id,
        "note": custom_note,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "utxo_transaction",
        "details": {
            "type": "utxo_transfer",
            "outputs": [
            {
                "to": {
                "type": "address",
                "address": destination
                },
                "value": value
            }
            ],
            "fee_per_byte": {
            "type": "priority",
            "priority_level": "low"
            },
            "push_mode": "auto"
        }
    }
    return request_json
