"""Chain registry and payload builders for all Fordefi-supported chains."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from ._types import FordefiError

# ---------------------------------------------------------------------------
# Chain configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ChainConfig:
    family: str          # evm, solana, utxo, cosmos, ton, tron, aptos, sui
    chain_id: str        # Fordefi chain identifier, e.g. "evm_ethereum_mainnet"
    tx_type: str         # e.g. "evm_transaction"
    detail_type: str     # e.g. "evm_transfer"
    asset_type: str      # e.g. "evm"
    dest_format: str     # "plain" | "hex" | "cosmos_address" | "btc_address"
    api_path: str = "/api/v1/transactions"
    # Token transfer config (None = chain doesn't support token transfers via this CLI)
    token_detail_type: str | None = None
    token_key: str | None = None
    token_addr_key: str | None = None
    # Swap support
    swap_chain_type: str | None = None  # chain_type param for swap providers endpoint


CHAINS: dict[str, ChainConfig] = {
    # EVM chains
    "ethereum": ChainConfig(
        family="evm", chain_id="evm_ethereum_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "bsc": ChainConfig(
        family="evm", chain_id="evm_bsc_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "polygon": ChainConfig(
        family="evm", chain_id="evm_polygon_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "arbitrum": ChainConfig(
        family="evm", chain_id="evm_arbitrum_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "optimism": ChainConfig(
        family="evm", chain_id="evm_optimism_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "avalanche": ChainConfig(
        family="evm", chain_id="evm_avalanche_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "base": ChainConfig(
        family="evm", chain_id="evm_base_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "fantom": ChainConfig(
        family="evm", chain_id="evm_fantom_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),
    "linea": ChainConfig(
        family="evm", chain_id="evm_linea_mainnet",
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    ),

    # Solana
    "solana": ChainConfig(
        family="solana", chain_id="solana_mainnet",
        tx_type="solana_transaction", detail_type="solana_transfer",
        asset_type="solana", dest_format="plain",
        token_detail_type="spl_token", token_key="token", token_addr_key="base58_repr",
        swap_chain_type="solana",
    ),

    # Bitcoin (UTXO) - uses different endpoint
    "bitcoin": ChainConfig(
        family="utxo", chain_id="bitcoin_mainnet",
        tx_type="utxo_transaction", detail_type="",
        asset_type="utxo", dest_format="btc_address",
        api_path="/api/v1/transactions/transfer",
    ),

    # Cosmos chains
    "cosmos": ChainConfig(
        family="cosmos", chain_id="cosmos_cosmoshub-4",
        tx_type="cosmos_transaction", detail_type="cosmos_transfer",
        asset_type="cosmos", dest_format="cosmos_address",
    ),
    "injective": ChainConfig(
        family="cosmos", chain_id="cosmos_injective-1",
        tx_type="cosmos_transaction", detail_type="cosmos_transfer",
        asset_type="cosmos", dest_format="cosmos_address",
    ),

    # TON
    "ton": ChainConfig(
        family="ton", chain_id="ton_mainnet",
        tx_type="ton_transaction", detail_type="ton_transfer",
        asset_type="ton", dest_format="hex",
        token_detail_type="jetton", token_key="jetton", token_addr_key="address",
    ),

    # TRON
    "tron": ChainConfig(
        family="tron", chain_id="tron_mainnet",
        tx_type="tron_transaction", detail_type="tron_transfer",
        asset_type="tron", dest_format="hex",
        token_detail_type="trc20", token_key="trc20", token_addr_key="base58_repr",
    ),

    # Aptos
    "aptos": ChainConfig(
        family="aptos", chain_id="aptos_mainnet",
        tx_type="aptos_transaction", detail_type="aptos_transfer",
        asset_type="aptos", dest_format="hex",
        token_detail_type="new_coin", token_key="new_coin_type", token_addr_key="metadata_address",
    ),

    # Sui
    "sui": ChainConfig(
        family="sui", chain_id="sui_mainnet",
        tx_type="sui_transaction", detail_type="sui_transfer",
        asset_type="sui", dest_format="hex",
        token_detail_type="coin", token_key="coin_type", token_addr_key="coin_type_str",
    ),
}


def resolve_chain(chain: str) -> ChainConfig:
    """Resolve a human-friendly chain name to its config.

    Supports:
    - Named chains: "ethereum", "solana", "bitcoin", etc.
    - Custom EVM by chain ID: "evm_42793" or just "42793"
    """
    if chain in CHAINS:
        return CHAINS[chain]

    # Custom EVM chain support: accept "evm_<id>" or raw chain ID
    chain_id_str = chain
    if chain.startswith("evm_"):
        chain_id_str = chain
    elif chain.isdigit():
        chain_id_str = f"evm_{chain}"
    else:
        available = ", ".join(sorted(CHAINS.keys()))
        raise FordefiError(
            f"Unknown chain '{chain}'. Available: {available}. "
            f"For custom EVM chains, use the chain ID number (e.g. '42793')."
        )

    return ChainConfig(
        family="evm", chain_id=chain_id_str,
        tx_type="evm_transaction", detail_type="evm_transfer",
        asset_type="evm", dest_format="plain",
        token_detail_type="erc20", token_key="token", token_addr_key="hex_repr",
        swap_chain_type="evm",
    )


# ---------------------------------------------------------------------------
# Destination formatting
# ---------------------------------------------------------------------------

def _format_destination(cfg: ChainConfig, address: str) -> Any:
    if cfg.dest_format == "plain":
        return address
    elif cfg.dest_format == "hex":
        return {"type": "hex", "address": address}
    elif cfg.dest_format == "cosmos_address":
        return {
            "type": "address",
            "address": {"chain": cfg.chain_id, "address": address},
        }
    elif cfg.dest_format == "btc_address":
        return {"type": "address", "address": address}
    else:
        raise FordefiError(f"Unknown dest_format: {cfg.dest_format}")


# ---------------------------------------------------------------------------
# Asset identifier formatting
# ---------------------------------------------------------------------------

def _format_asset_identifier(cfg: ChainConfig, token: str | None) -> dict:
    if token is None:
        return {
            "type": cfg.asset_type,
            "details": {"type": "native", "chain": cfg.chain_id},
        }

    if cfg.token_detail_type is None:
        raise FordefiError(
            f"Token transfers are not supported on '{cfg.family}' chain via this CLI."
        )

    return {
        "type": cfg.asset_type,
        "details": {
            "type": cfg.token_detail_type,
            cfg.token_key: {
                "chain": cfg.chain_id,
                cfg.token_addr_key: token,
            },
        },
    }


# ---------------------------------------------------------------------------
# Transfer payload builders
# ---------------------------------------------------------------------------

def build_transfer_payload(
    chain: str,
    vault_id: str,
    to: str,
    amount: str,
    token: str | None = None,
    note: str = "",
    memo: str | None = None,
    gas_priority: str = "medium",
) -> tuple[str, dict]:
    """Build a transfer payload for any supported chain.

    Returns (api_path, request_body_dict).
    """
    cfg = resolve_chain(chain)

    if cfg.family == "utxo":
        return _build_btc_transfer(cfg, vault_id, to, amount, note)
    elif cfg.family == "cosmos":
        return _build_cosmos_transfer(cfg, vault_id, to, amount, note, memo)
    elif cfg.family == "evm":
        return _build_evm_transfer(cfg, vault_id, to, amount, token, note, gas_priority)
    elif cfg.family == "solana":
        return _build_solana_transfer(cfg, vault_id, to, amount, token, note)
    else:
        # Generic pattern covers: ton, tron, aptos, sui
        return _build_generic_transfer(cfg, vault_id, to, amount, token, note)


def _build_evm_transfer(
    cfg: ChainConfig, vault_id: str, to: str, amount: str,
    token: str | None, note: str, gas_priority: str,
) -> tuple[str, dict]:
    body = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": note,
        "type": cfg.tx_type,
        "details": {
            "type": cfg.detail_type,
            "gas": {
                "type": "priority",
                "priority_level": gas_priority,
            },
            "to": to,
            "asset_identifier": _format_asset_identifier(cfg, token),
            "value": {"type": "value", "value": amount},
        },
    }
    return cfg.api_path, body


def _build_solana_transfer(
    cfg: ChainConfig, vault_id: str, to: str, amount: str,
    token: str | None, note: str,
) -> tuple[str, dict]:
    details: dict[str, Any] = {
        "type": cfg.detail_type,
        "to": to,
        "value": {"type": "value", "value": amount},
        "asset_identifier": _format_asset_identifier(cfg, token),
    }
    # SPL token transfers include a fee block
    if token is not None:
        details["fee"] = {"type": "custom", "unit_price": "100000000"}

    body = {
        "signer_type": "api_signer",
        "type": cfg.tx_type,
        "details": details,
        "note": note,
        "vault_id": vault_id,
    }
    return cfg.api_path, body


def _build_btc_transfer(
    cfg: ChainConfig, vault_id: str, to: str, amount: str, note: str,
) -> tuple[str, dict]:
    """Bitcoin uses /api/v1/transactions/transfer with a flat body."""
    body = {
        "to": {"type": "address", "address": to},
        "amount": {"type": "value", "value": amount},
        "asset_identifier": {
            "type": "utxo",
            "details": {"type": "native", "chain": cfg.chain_id},
        },
        "note": note,
        "vault_id": vault_id,
    }
    return cfg.api_path, body


def _build_cosmos_transfer(
    cfg: ChainConfig, vault_id: str, to: str, amount: str,
    note: str, memo: str | None,
) -> tuple[str, dict]:
    details: dict[str, Any] = {
        "type": cfg.detail_type,
        "push_mode": "auto",
        "to": {
            "type": "address",
            "address": {"chain": cfg.chain_id, "address": to},
        },
        "asset_identifier": _format_asset_identifier(cfg, None),
        "value": {"type": "value", "value": amount},
    }
    if memo is not None:
        details["memo"] = memo

    body = {
        "vault_id": vault_id,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": cfg.tx_type,
        "details": details,
    }
    return cfg.api_path, body


def _build_generic_transfer(
    cfg: ChainConfig, vault_id: str, to: str, amount: str,
    token: str | None, note: str,
) -> tuple[str, dict]:
    """Works for TON, TRON, Aptos, Sui - they share the same structure."""
    body = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": note,
        "type": cfg.tx_type,
        "details": {
            "type": cfg.detail_type,
            "to": _format_destination(cfg, to),
            "asset_identifier": _format_asset_identifier(cfg, token),
            "value": {"type": "value", "value": amount},
        },
    }
    return cfg.api_path, body


# ---------------------------------------------------------------------------
# EVM contract call payload builder
# ---------------------------------------------------------------------------

def build_evm_contract_call_payload(
    chain: str,
    vault_id: str,
    contract: str,
    call_data: str,
    value: str = "0",
    note: str = "",
    gas_limit: str | None = None,
    gas_priority: str = "medium",
) -> tuple[str, dict]:
    cfg = resolve_chain(chain)
    if cfg.family != "evm":
        raise FordefiError(f"Contract calls are only supported on EVM chains, got '{chain}'")

    if gas_limit:
        gas = {
            "type": "custom",
            "gas_limit": gas_limit,
            "details": {"type": "legacy", "price": "1000000000"},
        }
    else:
        gas = {"type": "priority", "priority_level": gas_priority}

    body = {
        "signer_type": "api_signer",
        "vault_id": vault_id,
        "note": note,
        "sign_mode": "auto",
        "type": "evm_transaction",
        "details": {
            "push_mode": "auto",
            "type": "evm_raw_transaction",
            "chain": cfg.chain_id,
            "gas": gas,
            "to": contract,
            "value": value,
            "data": {"type": "hex", "hex_data": call_data},
        },
    }
    return "/api/v1/transactions", body


# ---------------------------------------------------------------------------
# Swap payload builders
# ---------------------------------------------------------------------------

def _swap_asset_identifier(cfg: ChainConfig, token: str) -> dict:
    """Build asset identifier for swap payloads. 'native' means native asset."""
    if token == "native":
        return {
            "type": cfg.asset_type,
            "details": {"type": "native", "chain": cfg.chain_id},
        }

    if cfg.family == "evm":
        return {
            "type": cfg.asset_type,
            "details": {
                "type": "erc20",
                "token": {"chain": cfg.chain_id, "hex_repr": token},
            },
        }
    elif cfg.family == "solana":
        return {
            "type": cfg.asset_type,
            "details": {
                "type": "spl_token",
                "token": {"chain": cfg.chain_id, "base58_repr": token},
            },
        }
    else:
        raise FordefiError(f"Swaps are not supported on '{cfg.family}' chains")


def build_swap_quote_payload(
    cfg: ChainConfig,
    vault_id: str,
    sell_token: str,
    buy_token: str,
    amount: str,
    slippage_bps: str,
    providers: list[str],
) -> dict:
    return {
        "vault_id": vault_id,
        "input_asset_identifier": _swap_asset_identifier(cfg, sell_token),
        "output_asset_identifier": _swap_asset_identifier(cfg, buy_token),
        "amount": amount,
        "slippage_bps": slippage_bps,
        "signer_type": "api_signer",
        "requested_provider_ids": providers,
    }


def build_swap_submit_payload(
    cfg: ChainConfig,
    vault_id: str,
    quote_id: str,
    sell_token: str,
    buy_token: str,
    amount: str,
    slippage_bps: str,
) -> dict:
    body: dict[str, Any] = {
        "quote_id": quote_id,
        "vault_id": vault_id,
        "input_asset_identifier": _swap_asset_identifier(cfg, sell_token),
        "output_asset_identifier": _swap_asset_identifier(cfg, buy_token),
        "amount": amount,
        "slippage_bps": slippage_bps,
        "signer_type": "api_signer",
    }

    # EVM swaps include a fee block
    if cfg.family == "evm":
        body["fee"] = {
            "type": "evm",
            "details": {
                "type": "priority",
                "priority_level": "medium",
            },
        }

    return body


# ---------------------------------------------------------------------------
# EVM message signing payload builders
# ---------------------------------------------------------------------------

_CREATE_AND_WAIT_PATH = "/api/v1/transactions/create-and-wait"


def build_personal_message_payload(
    chain: str,
    vault_id: str,
    message: str,
) -> tuple[str, dict]:
    """Build a personal message (EIP-191) signing payload.

    Returns (api_path, request_body_dict).
    """
    cfg = resolve_chain(chain)
    if cfg.family != "evm":
        raise FordefiError(f"Message signing is only supported on EVM chains, got '{chain}'")

    hex_encoded = "0x" + message.encode("utf-8").hex()

    body = {
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "evm_message",
        "details": {
            "type": "personal_message_type",
            "raw_data": hex_encoded,
            "chain": cfg.chain_id,
        },
        "vault_id": vault_id,
        "wait_for_state": "signed",
        "timeout": 45,
    }
    return _CREATE_AND_WAIT_PATH, body


def build_typed_data_payload(
    chain: str,
    vault_id: str,
    typed_data: dict,
) -> tuple[str, dict]:
    """Build a typed data (EIP-712) signing payload.

    The typed_data dict is JSON-serialized and hex-encoded before sending.

    Returns (api_path, request_body_dict).
    """
    cfg = resolve_chain(chain)
    if cfg.family != "evm":
        raise FordefiError(f"Message signing is only supported on EVM chains, got '{chain}'")

    raw_json = json.dumps(typed_data)
    hex_encoded = "0x" + raw_json.encode("utf-8").hex()

    body = {
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "evm_message",
        "details": {
            "type": "typed_message_type",
            "raw_data": hex_encoded,
            "chain": cfg.chain_id,
        },
        "vault_id": vault_id,
        "wait_for_state": "signed",
        "timeout": 45,
    }
    return _CREATE_AND_WAIT_PATH, body
