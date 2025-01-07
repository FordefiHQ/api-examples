import json


with open("./aptos_tx.json", "r") as f:
    tx_data = json.load(f)

def get_gas_price_apt(tx_data):
    # Extract gas price in octas (Octas are the smallest APT denomination)
    gas_price_octa = int(tx_data["gas_submitted"]["price"]["price"])
    
    # Convert octas to APT
    gas_price_apt = gas_price_octa / 100000000
    return gas_price_apt


def get_gas_price_usd(tx_data):
    # Extract gas price in octas (Octas are the smallest APT denomination)
    gas_price_octa = int(tx_data["gas_submitted"]["price"]["price"])
    print(f"Octa price for 1 unit of gas -> {gas_price_octa}")
    
    # Extract APT price in USD (with 2 decimals)
    apt_price_usd = float(tx_data["gas_submitted"]["price"]["fiat_price"]["price"]) / 100
    print(f"APT price -> {apt_price_usd} USD")
    
    # Convert octa to APT (8 decimals)
    gas_price_apt = gas_price_octa / 100000000
    
    # Calculate USD value
    gas_price_usd = gas_price_apt * apt_price_usd
    
    return gas_price_usd

def calculate_gas_cost(tx_data):
    gas_units = int(tx_data["expected_result"]["fee_statement"]["total_charge_gas_units"])
    gas_price = int(tx_data["gas_submitted"]["price"]["price"])
    usd_price_cents = float(tx_data["expected_result"]["fee_statement"]["fiat_price"]["price"])
    
    total_octas = gas_units * gas_price
    total_apt = total_octas / 10**8
    usd_price = usd_price_cents / 100 
    
    return {
        "gas_octas": total_octas,
        "gas_apt": total_apt,
        "gas_usd": total_apt * usd_price
    }

def main ():
    price_usd = get_gas_price_usd(tx_data)
    price_apt = get_gas_price_apt(tx_data)
    total_gas_cost = calculate_gas_cost(tx_data)
    print(f"Gas price in USD -> ${price_usd:.8f}")
    print(f"Gas price in APT -> {price_apt:.8f}")
    print(f"Estimated gas cost in APT for tx -> {total_gas_cost['gas_apt']} APT")
    print(f"Estimated gas cost in USD for tx -> {total_gas_cost['gas_usd']} USD")

if __name__ == "__main__":
     main()
