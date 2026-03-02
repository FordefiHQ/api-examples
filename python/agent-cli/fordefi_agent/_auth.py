import base64
import datetime
import hashlib
import json
from typing import Any

import ecdsa
import requests

from ._types import FordefiError


class ApiAuth:
    """Handles Fordefi API authentication, request signing, and HTTP calls."""

    def __init__(self, api_token: str, pem_path: str, base_url: str):
        self._token = api_token
        self._base_url = base_url.rstrip("/")
        try:
            with open(pem_path, "r") as f:
                self._signing_key = ecdsa.SigningKey.from_pem(f.read())
        except FileNotFoundError:
            raise FordefiError(f"PEM file not found: {pem_path}")
        except Exception as e:
            raise FordefiError(f"Failed to load PEM key from {pem_path}: {e}")

    def _sign(self, payload: str) -> bytes:
        return self._signing_key.sign(
            data=payload.encode(),
            hashfunc=hashlib.sha256,
            sigencode=ecdsa.util.sigencode_der,
        )

    def _handle_error(self, resp: requests.Response, method: str, path: str) -> None:
        if resp.ok:
            return
        request_id = resp.headers.get("x-request-id")
        try:
            details = resp.json()
        except Exception:
            details = {"raw": resp.text}
        raise FordefiError(
            message=f"{method} {path} failed",
            status_code=resp.status_code,
            request_id=request_id,
            details=details,
        )

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        """GET request with Authorization header only."""
        resp = requests.get(
            f"{self._base_url}{path}",
            headers={"Authorization": f"Bearer {self._token}"},
            params=params,
        )
        self._handle_error(resp, "GET", path)
        return resp.json()

    def post_signed(self, path: str, body: dict) -> dict:
        """POST request with full signing (Authorization + x-signature + x-timestamp)."""
        body_json = json.dumps(body)
        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{path}|{timestamp}|{body_json}"
        signature = self._sign(payload)

        resp = requests.post(
            f"{self._base_url}{path}",
            headers={
                "Authorization": f"Bearer {self._token}",
                "x-signature": base64.b64encode(signature),
                "x-timestamp": timestamp.encode(),
            },
            data=body_json,
        )
        self._handle_error(resp, "POST", path)
        return resp.json()

    def post_auth_only(self, path: str, body: dict) -> dict:
        """POST request with Authorization header only (used for swap quotes)."""
        resp = requests.post(
            f"{self._base_url}{path}",
            headers={"Authorization": f"Bearer {self._token}"},
            json=body,
        )
        self._handle_error(resp, "POST", path)
        return resp.json()
