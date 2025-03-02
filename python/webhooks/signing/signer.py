import ecdsa
import hashlib

PRIVATE_KEY_PEM_FILE = "./secret/private.pem"

def sign(payload):

    with open(PRIVATE_KEY_PEM_FILE, "r") as f:
        signing_key = ecdsa.SigningKey.from_pem(f.read())

    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )

    return signature
