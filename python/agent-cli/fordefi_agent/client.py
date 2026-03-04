"""FordefiClient - the single entry point for AI agents interacting with Fordefi."""

from __future__ import annotations

import base64
import time
from typing import Any

from ._auth import ApiAuth
from ._sanitize import sanitize_amount, sanitize_uuid
from ._chains import (
    CHAINS,
    build_evm_contract_call_payload,
    build_personal_message_payload,
    build_swap_quote_payload,
    build_swap_submit_payload,
    build_transfer_payload,
    build_typed_data_payload,
    resolve_chain,
)
from ._types import FordefiError, FordefiTimeoutError

TERMINAL_STATES = {
    "completed", "mined", "aborted", "failed", "rejected", "stuck",
}


class FordefiClient:
    """Fordefi API client for AI agents.

    Provides simple, synchronous methods for transfers, contract calls,
    swaps, and read operations across all Fordefi-supported chains.

    Args:
        api_token: Fordefi API user token (FORDEFI_API_USER_TOKEN).
        pem_path: Path to the private.pem key file for request signing.
        vault_id: Default vault ID used when not specified per-call.
        base_url: Fordefi API base URL (default: https://api.fordefi.com).
    """

    def __init__(
        self,
        api_token: str,
        pem_path: str,
        vault_id: str,
        base_url: str = "https://api.fordefi.com",
    ):
        self._vault_id = vault_id
        self._api = ApiAuth(api_token, pem_path, base_url)

    def _resolve_vault(self, vault_id: str | None) -> str:
        return vault_id or self._vault_id

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def list_vaults(self) -> list[dict]:
        """List all vaults accessible to this API user."""
        resp = self._api.get("/api/v1/vaults")
        return resp.get("vaults", resp if isinstance(resp, list) else [resp])

    def get_balance(self, vault_id: str | None = None) -> list[dict]:
        """Get asset balances for a vault."""
        vid = self._resolve_vault(vault_id)
        resp = self._api.get(f"/api/v1/vaults/{vid}/assets")
        return resp.get("assets", resp if isinstance(resp, list) else [resp])

    def get_transaction(self, transaction_id: str) -> dict:
        """Get full details of a transaction by ID."""
        return self._api.get(f"/api/v1/transactions/{transaction_id}")

    def list_transactions(
        self,
        vault_id: str | None = None,
        state: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """List transactions with optional filters."""
        params: dict[str, Any] = {"page_size": limit}
        if vault_id:
            params["vault_id"] = vault_id
        if state:
            params["state"] = state
        resp = self._api.get("/api/v1/transactions", params=params)
        return resp.get("transactions", resp if isinstance(resp, list) else [resp])

    # ------------------------------------------------------------------
    # Transfers (all chains)
    # ------------------------------------------------------------------

    def transfer(
        self,
        chain: str,
        to: str,
        amount: str,
        token: str | None = None,
        vault_id: str | None = None,
        note: str = "",
        *,
        memo: str | None = None,
        gas_priority: str = "medium",
    ) -> dict:
        """Transfer native assets or tokens on any supported chain.

        Args:
            chain: Chain name (e.g. "ethereum", "solana", "bitcoin").
            to: Destination address.
            amount: Amount in the chain's smallest unit as a string.
            token: Token contract/mint address. None = native asset.
            vault_id: Override the default vault ID.
            note: Optional transaction note.
            memo: Optional memo (Cosmos chains).
            gas_priority: Gas priority for EVM chains ("low"/"medium"/"high").

        Returns:
            dict with "transaction_id", "state", and "raw_response".
        """
        vid = sanitize_uuid(self._resolve_vault(vault_id), "vault_id")
        amount = sanitize_amount(amount)
        api_path, body = build_transfer_payload(
            chain=chain,
            vault_id=vid,
            to=to,
            amount=amount,
            token=token,
            note=note,
            memo=memo,
            gas_priority=gas_priority,
        )
        raw = self._api.post_signed(api_path, body)
        return {
            "transaction_id": raw.get("id", ""),
            "state": raw.get("state", ""),
            "raw_response": raw,
        }

    # ------------------------------------------------------------------
    # EVM contract calls
    # ------------------------------------------------------------------

    def evm_contract_call(
        self,
        chain: str,
        contract: str,
        call_data: str,
        value: str = "0",
        vault_id: str | None = None,
        note: str = "",
        *,
        gas_limit: str | None = None,
        gas_priority: str = "medium",
    ) -> dict:
        """Execute a raw EVM contract call.

        Args:
            chain: EVM chain name (e.g. "ethereum", "bsc", "arbitrum").
            contract: Target contract address.
            call_data: Hex-encoded calldata (must start with 0x).
            value: Native currency amount in wei to send with the call.
            vault_id: Override the default vault ID.
            note: Optional transaction note.
            gas_limit: Custom gas limit. If None, uses priority-based estimation.
            gas_priority: Gas priority ("low"/"medium"/"high").

        Returns:
            dict with "transaction_id", "state", and "raw_response".
        """
        vid = sanitize_uuid(self._resolve_vault(vault_id), "vault_id")
        api_path, body = build_evm_contract_call_payload(
            chain=chain,
            vault_id=vid,
            contract=contract,
            call_data=call_data,
            value=value,
            note=note,
            gas_limit=gas_limit,
            gas_priority=gas_priority,
        )
        raw = self._api.post_signed(api_path, body)
        return {
            "transaction_id": raw.get("id", ""),
            "state": raw.get("state", ""),
            "raw_response": raw,
        }

    # ------------------------------------------------------------------
    # EVM message signing
    # ------------------------------------------------------------------

    @staticmethod
    def _decode_signature(raw: dict) -> dict:
        """Extract signature hex and r/s/v from a create-and-wait response."""
        signatures = raw.get("signatures", [])
        if not signatures:
            raise FordefiError("No signature returned in the response")

        sig_bytes = base64.b64decode(signatures[0])
        sig_hex = "0x" + sig_bytes.hex()
        r = hex(int.from_bytes(sig_bytes[0:32], byteorder="big"))
        s = hex(int.from_bytes(sig_bytes[32:64], byteorder="big"))
        v = int(sig_bytes[64])

        return {
            "signature": sig_hex,
            "r": r,
            "s": s,
            "v": v,
            "transaction_id": raw.get("id", ""),
            "raw_response": raw,
        }

    def sign_personal_message(
        self,
        chain: str,
        message: str,
        vault_id: str | None = None,
    ) -> dict:
        """Sign a personal message (EIP-191) with an EVM vault.

        Args:
            chain: EVM chain name (e.g. "ethereum", "polygon", "arbitrum").
            message: The plain-text message to sign.
            vault_id: Override the default vault ID.

        Returns:
            dict with "signature", "r", "s", "v", "transaction_id",
            and "raw_response".
        """
        vid = sanitize_uuid(self._resolve_vault(vault_id), "vault_id")
        api_path, body = build_personal_message_payload(
            chain=chain,
            vault_id=vid,
            message=message,
        )
        raw = self._api.post_signed(api_path, body)
        return self._decode_signature(raw)

    def sign_typed_data(
        self,
        chain: str,
        typed_data: dict,
        vault_id: str | None = None,
    ) -> dict:
        """Sign EIP-712 typed data with an EVM vault.

        Args:
            chain: EVM chain name (e.g. "ethereum", "polygon", "arbitrum").
            typed_data: The EIP-712 typed data dict (must include "types",
                "domain", "primaryType", and "message").
            vault_id: Override the default vault ID.

        Returns:
            dict with "signature", "r", "s", "v", "transaction_id",
            and "raw_response".
        """
        vid = sanitize_uuid(self._resolve_vault(vault_id), "vault_id")
        api_path, body = build_typed_data_payload(
            chain=chain,
            vault_id=vid,
            typed_data=typed_data,
        )
        raw = self._api.post_signed(api_path, body)
        return self._decode_signature(raw)

    # ------------------------------------------------------------------
    # Swaps
    # ------------------------------------------------------------------

    def get_swap_quote(
        self,
        chain: str,
        sell_token: str,
        buy_token: str,
        amount: str,
        vault_id: str | None = None,
        *,
        slippage_bps: str = "500",
    ) -> dict:
        """Get swap quotes without executing.

        Args:
            chain: Chain name (e.g. "ethereum", "solana").
            sell_token: Token to sell ("native" for native asset, or contract address).
            buy_token: Token to buy (contract address).
            amount: Amount to sell in smallest units.
            vault_id: Override the default vault ID.
            slippage_bps: Slippage tolerance in basis points (default "500" = 5%).

        Returns:
            dict with "best_quote" (or None) and "all_quotes".
        """
        vid = sanitize_uuid(self._resolve_vault(vault_id), "vault_id")
        amount = sanitize_amount(amount)
        cfg = resolve_chain(chain)

        if not cfg.swap_chain_type:
            raise FordefiError(f"Swaps are not supported on '{chain}'")

        # Get providers
        providers_resp = self._api.get(
            f"/api/v1/swaps/providers/{cfg.swap_chain_type}"
        )
        provider_ids = [
            p["provider_id"] for p in providers_resp.get("providers", [])
        ]
        if not provider_ids:
            raise FordefiError(f"No swap providers available for {chain}")

        # Get quotes
        quote_body = build_swap_quote_payload(
            cfg=cfg,
            vault_id=vid,
            sell_token=sell_token,
            buy_token=buy_token,
            amount=amount,
            slippage_bps=slippage_bps,
            providers=provider_ids,
        )
        quotes_resp = self._api.post_auth_only("/api/v1/swaps/quotes", quote_body)

        # Find best quote
        best_quote = None
        all_quotes = []
        for provider in quotes_resp.get("providers_with_quote", []):
            quote = provider.get("quote")
            if quote and not provider.get("api_error"):
                entry = {
                    **quote,
                    "provider_info": provider.get("provider_info", {}),
                }
                all_quotes.append(entry)

        if all_quotes:
            best_quote = max(all_quotes, key=lambda q: int(q.get("output_amount", "0")))

        return {"best_quote": best_quote, "all_quotes": all_quotes}

    def swap(
        self,
        chain: str,
        sell_token: str,
        buy_token: str,
        amount: str,
        vault_id: str | None = None,
        *,
        slippage_bps: str = "500",
    ) -> dict:
        """Execute a token swap (full workflow: providers -> quotes -> submit).

        Args:
            chain: Chain name (e.g. "ethereum", "solana").
            sell_token: Token to sell ("native" for native asset, or contract address).
            buy_token: Token to buy (contract address).
            amount: Amount to sell in smallest units.
            vault_id: Override the default vault ID.
            slippage_bps: Slippage tolerance in basis points (default "500" = 5%).

        Returns:
            dict with "transaction_id", "state", "quote", and "raw_response".
        """
        vid = sanitize_uuid(self._resolve_vault(vault_id), "vault_id")
        amount = sanitize_amount(amount)
        cfg = resolve_chain(chain)

        # Get quotes
        quote_result = self.get_swap_quote(
            chain=chain,
            sell_token=sell_token,
            buy_token=buy_token,
            amount=amount,
            vault_id=vid,
            slippage_bps=slippage_bps,
        )

        best = quote_result["best_quote"]
        if not best:
            raise FordefiError("No valid swap quotes available from any provider")

        # Submit the swap
        submit_body = build_swap_submit_payload(
            cfg=cfg,
            vault_id=vid,
            quote_id=best["quote_id"],
            sell_token=sell_token,
            buy_token=buy_token,
            amount=amount,
            slippage_bps=slippage_bps,
        )
        raw = self._api.post_signed("/api/v1/swaps", submit_body)

        return {
            "transaction_id": raw.get("id", ""),
            "state": raw.get("state", ""),
            "quote": best,
            "raw_response": raw,
        }

    # ------------------------------------------------------------------
    # Polling
    # ------------------------------------------------------------------

    def wait_for_transaction(
        self,
        transaction_id: str,
        timeout_seconds: int = 120,
        poll_interval: int = 3,
    ) -> dict:
        """Poll a transaction until it reaches a terminal state.

        Terminal states: completed, mined, aborted, failed, rejected, stuck.

        Args:
            transaction_id: The transaction ID to poll.
            timeout_seconds: Maximum time to wait (default 120s).
            poll_interval: Seconds between polls (default 3s).

        Returns:
            The full transaction dict once it reaches a terminal state.

        Raises:
            FordefiTimeoutError: If the timeout is exceeded.
        """
        start = time.monotonic()
        while True:
            tx = self.get_transaction(transaction_id)
            state = tx.get("state", "")
            if state in TERMINAL_STATES:
                return tx
            elapsed = time.monotonic() - start
            if elapsed + poll_interval > timeout_seconds:
                raise FordefiTimeoutError(transaction_id, timeout_seconds)
            time.sleep(poll_interval)
