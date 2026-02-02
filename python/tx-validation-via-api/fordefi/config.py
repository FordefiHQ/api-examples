import os
from dotenv import load_dotenv


class Config:
    FORDEFI_API_BASE_URL = "https://api.fordefi.com/api/v1"
    ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

    TERMINAL_TRANSACTION_STATES = [
        "aborted", "completed", "approved", "stuck",
        "signed", "pushed_to_blockchain", "mined"
    ]

    def __init__(self):
        load_dotenv()
        self.validator_token = os.environ["VALIDATOR_BOT_TOKEN"]
        self.origin_vault = os.environ["ORIGIN_VAULT"]
        self._load_public_key()

    def _load_public_key(self):
        public_key_path = os.environ["FORDEFI_PUBLIC_KEY_PATH"]
        with open(public_key_path, "r") as key_file:
            self.fordefi_public_key = key_file.read()
