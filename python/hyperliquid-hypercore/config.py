import os
from pathlib import Path
from typing import TypedDict

class HyperliquidConfig(TypedDict):
    action: str
    isTestnet: bool
    destination: str
    amount: str
    isDeposit: bool

hyperliquid_config: HyperliquidConfig = {
    'action': 'sendUsd',
    'isTestnet': False,
    'destination': '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73',  # Change to your destination address
    'amount': '1',
    'isDeposit': True
}

API_ENDPOINT = "/api/v1/transactions"
API_USER_ACCESS_TOKEN = os.getenv("FORDEFI_API_TOKEN")
API_USER_PRIVATE_KEY = Path("./secret/private.pem")