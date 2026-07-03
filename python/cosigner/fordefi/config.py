import os
from dotenv import load_dotenv


class Config:
    FORDEFI_API_BASE_URL = "https://api.fordefi.com/api/v1"
    ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

    ALLOWED_SOURCE_IPS = {"54.243.103.88"}  # Fordefi's NAT IP

    TERMINAL_TRANSACTION_STATES = [
        "aborted", "completed", "approved", "stuck",
        "signed", "pushed_to_blockchain", "mined"
    ]

    def __init__(self):
        load_dotenv()
        self.api_user_token = os.environ["FORDEFI_API_USER_TOKEN"]
        self.origin_vault = os.environ["ORIGIN_VAULT"]
        self._load_public_key()

    def _load_public_key(self):
        public_key_path = os.environ.get("FORDEFI_PUBLIC_KEY_PATH", "./public_key.pem")
        with open(public_key_path, "r") as key_file:
            self.fordefi_public_key = key_file.read()
