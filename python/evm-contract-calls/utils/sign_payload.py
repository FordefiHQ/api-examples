import ecdsa
import hashlib
from pathlib import Path

def sign_with_api_user_private_key(payload: str, api_user_private_key: Path) -> bytes:
    print('Signing the payload 🖋️')
    with open(api_user_private_key, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())
    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )
    print("Payload signed! ✅")

    return signature