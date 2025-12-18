import ecdsa
from ecdsa.util import sigencode_der
import hashlib
from pathlib import Path

async def sign(payload: str, api_user_private_key: str | Path) -> bytes:
    print('Signing the payload 🖋️')
    with open(api_user_private_key, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())
    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=sigencode_der
    )
    print("Payload signed! ✅")

    return signature