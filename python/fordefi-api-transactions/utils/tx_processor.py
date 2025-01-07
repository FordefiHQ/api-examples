__all__ = ['process_transaction']

import os
from decimal import Decimal
from api_requests.tx_constructor import evm_tx_native, sol_tx_native, sui_tx_native, ton_tx_native, aptos_tx_native, btc_tx_native
from api_requests.tx_constructor_tokens import evm_tx_tokens, sol_tx_tokens
from utils.ecosysten_configs import get_ecosystem_config

def process_transaction(ecosystem, evm_chain, vault_id, destination, value, custom_note, token):
    config = get_ecosystem_config(ecosystem)
    if not config:
        raise ValueError("Invalid ecosystem")

    if vault_id == "default":
        vault_id = os.getenv(config["vault_env"])
        print(f"Sending from vault {vault_id}")
    if destination == "default":
        destination = config["default_dest"]

    try:
        value = value.replace(",", ".")
        float_value = float(value)
        if token:
            if ecosystem == "evm" and token == "usdt":
                smallest_unit = int(Decimal(value) * Decimal('1000000000000000000'))  # 18 decimals for USDT
            else:
                smallest_unit = int(Decimal(value) * Decimal('1000000'))  # 6 decimals for other tokens
            assert smallest_unit > 0, f"{token} amount must be positive!"
            print(f"Sending {value} {token.upper()} on {evm_chain.title()}!")
        else:
            smallest_unit = int(float_value * config["decimals"])
            assert smallest_unit > 0, f"{config['unit_name']} amount must be positive!"
            if evm_chain == 'bsc':
                print(f"Sending {float_value} BNB!")
            else:
                print(f"Sending {float_value} {config['unit_name'].upper()} on {evm_chain.title()}!")
            
        
        if token:
            tx_functions = {
                "evm": evm_tx_tokens,
                "sol": sol_tx_tokens,
            }
        else:

            tx_functions = {
                "sol": sol_tx_native,
                "evm": evm_tx_native,
                "sui": sui_tx_native,
                "ton": ton_tx_native,
                "apt": aptos_tx_native,
                "btc": btc_tx_native,
            }

        if tx_functions[ecosystem] == evm_tx_native:
            return tx_functions[ecosystem](evm_chain, vault_id, destination, custom_note, str(smallest_unit))
        elif tx_functions[ecosystem] == evm_tx_tokens:
            return tx_functions[ecosystem](evm_chain, vault_id, destination, custom_note, value, token)
        elif tx_functions[ecosystem] == sol_tx_tokens:
            return tx_functions[ecosystem](vault_id, destination, custom_note, str(smallest_unit), token)
        else:
            return tx_functions[ecosystem](vault_id, destination, custom_note, str(smallest_unit))
    except ValueError:
        print(f"❌ Invalid amount provided or token not supported by this tool yet!")
        exit(1)