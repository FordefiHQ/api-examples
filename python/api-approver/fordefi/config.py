import os
from dotenv import load_dotenv


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    FORDEFI_API_BASE_URL = "https://api.fordefi.com/api/v1"
    ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

    ALLOWED_SOURCE_IPS = {"54.243.103.88"}  # Fordefi's NAT IP

    def __init__(self):
        load_dotenv()
        self.api_user_token = os.environ["FORDEFI_API_USER_TOKEN"]
        self.origin_vault = os.environ["ORIGIN_VAULT"]
        # Only enable behind a proxy that overwrites X-Forwarded-For (ngrok, your load
        # balancer). Left off, the header is ignored so nobody can spoof Fordefi's IP.
        self.trust_proxy_header = _env_flag("TRUST_PROXY_HEADER")
        self._load_public_key()

    def _load_public_key(self):
        public_key_path = os.environ.get("FORDEFI_PUBLIC_KEY_PATH", "./public_key.pem")
        with open(public_key_path, "r") as key_file:
            self.fordefi_public_key = key_file.read()
