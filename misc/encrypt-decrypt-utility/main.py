import argparse
import getpass
import base64
import pyrage
import sys


def validate_passphrase(passphrase: str) -> None:
    if len(passphrase) < 8:
        raise ValueError("Passphrase must be at least 8 characters long.")


def encrypt(secret: str, passphrase: str) -> str:
    encrypted = pyrage.passphrase.encrypt(secret.encode(), passphrase)
    return base64.b64encode(encrypted).decode()


def decrypt(blob: str, passphrase: str) -> str:
    decrypted = pyrage.passphrase.decrypt(base64.b64decode(blob), passphrase)
    return decrypted.decode()


def main():
    parser = argparse.ArgumentParser(
        description="Encrypt and decrypt secrets with age (passphrase-based)."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    enc = sub.add_parser("encrypt", aliases=["e"], help="Encrypt a secret string")
    enc.add_argument(
        "secret", nargs="?", help="The secret to encrypt (omit to read from stdin)"
    )
    enc.add_argument(
        "-p", "--passphrase", help="Passphrase (omit to be prompted securely)"
    )

    dec = sub.add_parser("decrypt", aliases=["d"], help="Decrypt an encrypted blob")
    dec.add_argument(
        "blob", nargs="?", help="Base64 blob to decrypt (omit to read from stdin)"
    )
    dec.add_argument(
        "-p", "--passphrase", help="Passphrase (omit to be prompted securely)"
    )

    args = parser.parse_args()

    if args.command in ("encrypt", "e"):
        secret = args.secret or sys.stdin.read().strip()
        if not secret:
            parser.error("No secret provided")
        passphrase = args.passphrase or getpass.getpass("Passphrase: ")
        validate_passphrase(passphrase)
        blob = encrypt(secret, passphrase)
        print(blob)

    elif args.command in ("decrypt", "d"):
        blob = args.blob or sys.stdin.read().strip()
        if not blob:
            parser.error("No blob provided")
        passphrase = args.passphrase or getpass.getpass("Passphrase: ")
        validate_passphrase(passphrase)
        plaintext = decrypt(blob, passphrase)
        print(plaintext)


if __name__ == "__main__":
    main()
