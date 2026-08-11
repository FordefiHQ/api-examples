"""Test environment for importing the app module.

approver.py builds its Config, signature verifier and log directory at import time, so
the environment has to be in place before the module is imported. Values are set here
(not via a fixture) because conftest is imported before any test module. No credential
is real and nothing in the suite makes a network call.
"""

import os
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

os.environ["FORDEFI_API_USER_TOKEN"] = "test-token-not-a-real-credential"
os.environ["ORIGIN_VAULT"] = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73"
os.environ["FORDEFI_PUBLIC_KEY_PATH"] = str(PROJECT_ROOT / "public_key.pem")
os.environ["TRUST_PROXY_HEADER"] = "false"
os.environ["LOG_DIR"] = tempfile.mkdtemp(prefix="api-approver-tests-")
