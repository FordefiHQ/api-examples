import ecdsa # type: ignore
import hashlib


private_key_file = "./secret/private.pem"

with open(private_key_file, "r") as f:
    signing_key = ecdsa.SigningKey.from_pem(f.read())

def sign(payload):


    signature = signing_key.sign(
        data=payload.encode(), hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_der
    )

    return signature
