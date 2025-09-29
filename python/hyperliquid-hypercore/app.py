import os
import json
import asyncio
import datetime
from pathlib import Path
from broadcast import broadcast_tx
from sign_payload import sign
from dotenv import load_dotenv

load_dotenv()

## CONFIG
USER_API_TOKEN = os.getenv("FORDEFI_API_TOKEN")
PRIVATE_KEY_PEM_FILE = Path("./secret/private.pem")
name = "Pendle router"
chain_type = "evm"
group_ids = ["82a840da-78ca-439d-b874-0fd7daf54fb4"]
chains = ["evm_ethereum_mainnet"] # for CUSTOM evm chains use "evm_chainId", for example evm_747474
contact_address = "0x888888888889758F76e7103c6CbF23ABbF58F946"
path = "/api/v1/addressbook/contacts"
import example_utils

from hyperliquid.utils import constants


def main():
    address, info, exchange = example_utils.setup(constants.TESTNET_API_URL, skip_ws=True)
    testnet_HLP_vault = "0xa15099a30bbf2e68942d6f4c43d70d04faeab0a0"

    # Transfer 5 usd to the HLP Vault for demonstration purposes
    transfer_result = exchange.vault_usd_transfer(testnet_HLP_vault, True, 5_000_000)
    print(transfer_result)


if __name__ == "__main__":
    main()