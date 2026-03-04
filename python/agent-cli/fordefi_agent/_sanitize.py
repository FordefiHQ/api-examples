"""Input sanitization and validation for addresses, amounts, and identifiers."""

from __future__ import annotations

import re

from ._types import FordefiError

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)
_EVM_ADDR_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_HEX_DATA_RE = re.compile(r"^0x[0-9a-fA-F]*$")
_BASE58_CHARS = set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
_BECH32_CHARS = set("qpzry9x8gf2tvdw0s3jn54khce6mua7l")


def _strip_and_check_empty(val: str, label: str) -> str:
    val = val.strip()
    if not val:
        raise FordefiError(f"{label} must not be empty")
    return val


def sanitize_evm_address(addr: str, label: str = "address") -> str:
    addr = _strip_and_check_empty(addr, label)
    if not _EVM_ADDR_RE.match(addr):
        raise FordefiError(
            f"Invalid EVM {label}: '{addr}'. Expected 0x followed by 40 hex characters."
        )
    return addr


def sanitize_solana_address(addr: str, label: str = "address") -> str:
    addr = _strip_and_check_empty(addr, label)
    if not (32 <= len(addr) <= 44):
        raise FordefiError(
            f"Invalid Solana {label}: '{addr}'. Expected 32-44 base58 characters."
        )
    if not set(addr).issubset(_BASE58_CHARS):
        raise FordefiError(
            f"Invalid Solana {label}: '{addr}'. Contains non-base58 characters."
        )
    return addr


def sanitize_btc_address(addr: str, label: str = "address") -> str:
    addr = _strip_and_check_empty(addr, label)
    if not (addr.startswith(("1", "3", "bc1", "tb1"))):
        raise FordefiError(
            f"Invalid Bitcoin {label}: '{addr}'. Expected address starting with 1, 3, bc1, or tb1."
        )
    if not re.match(r"^[a-zA-Z0-9]+$", addr):
        raise FordefiError(
            f"Invalid Bitcoin {label}: '{addr}'. Contains invalid characters."
        )
    return addr


def sanitize_cosmos_address(addr: str, label: str = "address") -> str:
    addr = _strip_and_check_empty(addr, label)
    # Bech32: prefix + "1" + data chars
    if "1" not in addr:
        raise FordefiError(
            f"Invalid Cosmos {label}: '{addr}'. Expected bech32 format (e.g. cosmos1...)."
        )
    prefix, _, data = addr.partition("1")
    if not prefix or not data:
        raise FordefiError(
            f"Invalid Cosmos {label}: '{addr}'. Expected bech32 format (e.g. cosmos1...)."
        )
    if not set(data).issubset(_BECH32_CHARS):
        raise FordefiError(
            f"Invalid Cosmos {label}: '{addr}'. Contains invalid bech32 characters."
        )
    return addr


def sanitize_hex_address(addr: str, label: str = "address") -> str:
    """Validate hex-format addresses used by TON, Aptos, Sui."""
    addr = _strip_and_check_empty(addr, label)
    # TON raw format: "0:hex" or "0x..." or plain hex
    if ":" in addr:
        # TON raw format like "0:abc123..."
        parts = addr.split(":")
        if len(parts) != 2 or not re.match(r"^-?[0-9]+$", parts[0]) or not re.match(r"^[0-9a-fA-F]+$", parts[1]):
            raise FordefiError(
                f"Invalid {label}: '{addr}'. Expected TON raw format (e.g. 0:abc123...)."
            )
    elif addr.startswith("0x"):
        if not re.match(r"^0x[0-9a-fA-F]+$", addr):
            raise FordefiError(
                f"Invalid hex {label}: '{addr}'. Expected 0x followed by hex characters."
            )
    else:
        # Some addresses may be in other formats (e.g. TON user-friendly)
        if not re.match(r"^[a-zA-Z0-9_\-+/=]+$", addr):
            raise FordefiError(
                f"Invalid {label}: '{addr}'. Contains invalid characters."
            )
    return addr


def sanitize_tron_address(addr: str, label: str = "address") -> str:
    addr = _strip_and_check_empty(addr, label)
    if not addr.startswith("T"):
        raise FordefiError(
            f"Invalid TRON {label}: '{addr}'. Expected address starting with 'T'."
        )
    if not set(addr).issubset(_BASE58_CHARS):
        raise FordefiError(
            f"Invalid TRON {label}: '{addr}'. Contains non-base58 characters."
        )
    return addr


def sanitize_hex_data(data: str, label: str = "call_data") -> str:
    data = _strip_and_check_empty(data, label)
    if not data.startswith("0x"):
        raise FordefiError(
            f"Invalid {label}: must start with '0x'."
        )
    if not _HEX_DATA_RE.match(data):
        raise FordefiError(
            f"Invalid {label}: '{data}'. Contains non-hex characters after 0x prefix."
        )
    return data


def sanitize_uuid(val: str, label: str = "vault_id") -> str:
    val = _strip_and_check_empty(val, label)
    if not _UUID_RE.match(val):
        raise FordefiError(
            f"Invalid {label}: '{val}'. Expected UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)."
        )
    return val


def sanitize_amount(val: str, label: str = "amount") -> str:
    val = _strip_and_check_empty(val, label)
    if not re.match(r"^[0-9]+$", val):
        raise FordefiError(
            f"Invalid {label}: '{val}'. Expected a non-negative integer string."
        )
    return val


def sanitize_address_for_chain(family: str, addr: str, label: str = "address") -> str:
    """Dispatch to the right sanitizer based on chain family."""
    if family == "evm":
        return sanitize_evm_address(addr, label)
    elif family == "solana":
        return sanitize_solana_address(addr, label)
    elif family == "utxo":
        return sanitize_btc_address(addr, label)
    elif family == "cosmos":
        return sanitize_cosmos_address(addr, label)
    elif family == "tron":
        return sanitize_tron_address(addr, label)
    else:
        # ton, aptos, sui
        return sanitize_hex_address(addr, label)
