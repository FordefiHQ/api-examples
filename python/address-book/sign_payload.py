import ecdsa
import hashlib
from pathlib import Path

async def sign_with_api_user_private_key(payload: str, private_key_path: Path) -> bytes:
    print('Signing the payload 🖋️')
    with open(private_key_path, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())    
    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )
    print("Payload signed! ✅")

    return signature