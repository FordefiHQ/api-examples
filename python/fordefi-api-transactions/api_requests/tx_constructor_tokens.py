__all__ = ['evm_tx_tokens', 'sol_tx_tokens']

from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()

def evm_tx_tokens(evm_chain, vault_id, destination, custom_note, value, token):

    if evm_chain == "arbitrum":
        if token == "usdc":
            contract_address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            value = str(int(Decimal(value) * Decimal('1000000')))  # 6 decimals
        elif token == "usdt":
            contract_address = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
            value = str(int(Decimal(value) * Decimal('1000000')))  # 6 decimals
        else:
            raise ValueError(f"Token '{token}' is not supported for chain '{evm_chain}'") 
    elif evm_chain == "bsc":
        if token == "usdt":
            contract_address = "0x55d398326f99059fF775485246999027B3197955"
            value = str(int(Decimal(value) * Decimal('1000000000000000000')))
        else:
            raise ValueError(f"Token '{token}' is not supported for chain '{evm_chain}'")   # 18 decimals
    elif evm_chain == "ethereum":
        if token == "usdt":
            contract_address = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
            value = str(int(Decimal(value) * Decimal('1000000')))  # 6 decimals
        else:
            raise ValueError(f"Token '{token}' is not supported for chain '{evm_chain}'") 
    else:
        raise ValueError(f"Token '{token}' is not supported for chain '{evm_chain}'")

    request_json =  {
    "signer_type": "api_signer",
    "type": "evm_transaction",
    "details": {
        "type": "evm_transfer",
        "gas": {
          "type": "priority",
          "priority_level": "medium"
        },
        "to": destination,
        "value": {
           "type": "value",
           "value": value
        },
        "asset_identifier": {
             "type": "evm",
             "details": {
                 "type": "erc20",
                 "token": {
                     "chain": f"evm_{evm_chain}_mainnet",
                     "hex_repr": contract_address
                 }
             }
        }
    },
    "note": custom_note,
    "vault_id": vault_id
}

    return request_json

def sol_tx_tokens(vault_id, destination, custom_note, value, token):

    print(f"Sending {value} {token} from {vault_id} to {destination}")

    if token =="usdc":
        program_address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    else:
        program_address = ""

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
                    "type": "spl_token",
                    "token": {
                        "chain": "solana_mainnet",
                        "base58_repr": program_address
                    }
                }
            }
        },
        "note": custom_note,
        "vault_id": vault_id
    }


    return request_json