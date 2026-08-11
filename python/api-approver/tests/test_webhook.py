"""Tests for the webhook endpoint's authorization layer.

Requests are faked rather than driven through TestClient so the suite needs no extra
HTTP dependency, and so the oversized-body cases never actually allocate a body.
"""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers

import approver
from approver import MAX_BODY_BYTES, get_source_ip, handle_webhook

FORDEFI_IP = "54.243.103.88"


class FakeRequest:
    def __init__(self, *, client_host=None, headers=None, body=b""):
        self.headers = Headers(headers or {})
        self.client = SimpleNamespace(host=client_host) if client_host else None
        self._body = body

    async def body(self) -> bytes:
        return self._body


def call_webhook(request: FakeRequest) -> HTTPException:
    """Run the handler and return the HTTPException it raised."""
    with pytest.raises(HTTPException) as raised:
        asyncio.run(handle_webhook(request))
    return raised.value


class TestGetSourceIp:
    def test_forwarded_for_ignored_when_proxy_untrusted(self):
        request = FakeRequest(client_host="203.0.113.9", headers={"x-forwarded-for": FORDEFI_IP})
        assert get_source_ip(request, trust_proxy_header=False) == "203.0.113.9"

    def test_forwarded_for_used_when_proxy_trusted(self):
        request = FakeRequest(client_host="127.0.0.1", headers={"x-forwarded-for": FORDEFI_IP})
        assert get_source_ip(request, trust_proxy_header=True) == FORDEFI_IP

    def test_first_hop_is_taken_and_stripped(self):
        request = FakeRequest(
            client_host="127.0.0.1", headers={"x-forwarded-for": f" {FORDEFI_IP} , 10.0.0.1"}
        )
        assert get_source_ip(request, trust_proxy_header=True) == FORDEFI_IP

    def test_socket_ip_used_when_header_absent_and_proxy_trusted(self):
        request = FakeRequest(client_host="198.51.100.4")
        assert get_source_ip(request, trust_proxy_header=True) == "198.51.100.4"

    def test_missing_client_is_unknown(self):
        assert get_source_ip(FakeRequest(), trust_proxy_header=False) == "unknown"


class TestSourceIpEnforcement:
    def test_spoofed_forwarded_for_is_rejected(self, monkeypatch):
        """The whole point of TRUST_PROXY_HEADER: a spoofed header must not pass."""
        monkeypatch.setattr(approver.config, "trust_proxy_header", False)
        request = FakeRequest(
            client_host="203.0.113.9",
            headers={"x-forwarded-for": FORDEFI_IP, "X-Signature": "irrelevant"},
        )
        assert call_webhook(request).status_code == 403

    def test_forwarded_for_accepted_when_proxy_trusted(self, monkeypatch):
        monkeypatch.setattr(approver.config, "trust_proxy_header", True)
        request = FakeRequest(client_host="127.0.0.1", headers={"x-forwarded-for": FORDEFI_IP})
        # Past the IP check, so it fails on the missing signature instead.
        assert call_webhook(request).status_code == 401

    def test_unauthorized_ip_is_rejected(self, monkeypatch):
        monkeypatch.setattr(approver.config, "trust_proxy_header", False)
        assert call_webhook(FakeRequest(client_host="203.0.113.9")).status_code == 403

    def test_invalid_signature_is_rejected(self, monkeypatch):
        monkeypatch.setattr(approver.config, "trust_proxy_header", False)
        request = FakeRequest(
            client_host=FORDEFI_IP, headers={"X-Signature": "bm90LWEtc2lnbmF0dXJl"}, body=b"{}"
        )
        assert call_webhook(request).status_code == 401


class TestBodyLimit:
    def test_oversized_content_length_is_rejected(self, monkeypatch):
        monkeypatch.setattr(approver.config, "trust_proxy_header", False)
        request = FakeRequest(
            client_host=FORDEFI_IP,
            headers={"content-length": str(MAX_BODY_BYTES + 1), "X-Signature": "irrelevant"},
        )
        assert call_webhook(request).status_code == 413

    def test_oversized_body_is_rejected_when_content_length_lies(self, monkeypatch):
        monkeypatch.setattr(approver.config, "trust_proxy_header", False)
        request = FakeRequest(
            client_host=FORDEFI_IP,
            headers={"content-length": "2", "X-Signature": "irrelevant"},
            body=b"x" * (MAX_BODY_BYTES + 1),
        )
        assert call_webhook(request).status_code == 413

    def test_unauthorized_ip_is_rejected_before_the_body_is_read(self, monkeypatch):
        """Authorization must not depend on the payload, so an unauthorized caller
        cannot make the service buffer one."""
        monkeypatch.setattr(approver.config, "trust_proxy_header", False)

        class ExplodingRequest(FakeRequest):
            async def body(self):
                raise AssertionError("body was read before the IP check")

        request = ExplodingRequest(client_host="203.0.113.9")
        assert call_webhook(request).status_code == 403
