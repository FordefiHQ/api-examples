import base64
import hashlib
import ecdsa
from ecdsa.util import sigdecode_der


class SignatureVerifier:
    def __init__(self, public_key_pem: str):
        self.verifying_key = ecdsa.VerifyingKey.from_pem(public_key_pem)

    def is_valid_signature(self, signature: str, body: bytes) -> bool:
        try:
            return self.verifying_key.verify(
                signature=base64.b64decode(signature),
                data=body,
                hashfunc=hashlib.sha256,
                sigdecode=sigdecode_der,
            )
        except Exception as error:
            print(f"Signature verification failed: {error}")
            return False
