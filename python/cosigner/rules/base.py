import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Dict, List, Optional

from fordefi import Config
from .calldata import DecodedCall

logger = logging.getLogger("cosigner.rules")


class Verdict(Enum):
    PASSED = "passed"    # rule applied and the check succeeded
    SKIPPED = "skipped"  # rule does not apply to this transaction
    ABORT = "abort"      # rule applied and the check failed (or could not complete)


@dataclass
class RuleResult:
    verdict: Verdict
    reason: str = ""

    @classmethod
    def passed(cls, reason: str = "") -> "RuleResult":
        return cls(Verdict.PASSED, reason)

    @classmethod
    def skipped(cls, reason: str = "") -> "RuleResult":
        return cls(Verdict.SKIPPED, reason)

    @classmethod
    def abort(cls, reason: str) -> "RuleResult":
        return cls(Verdict.ABORT, reason)


@dataclass
class RuleContext:
    transaction: Dict                    # full transaction from GET /api/v1/transactions/{id}
    config: Config
    decoded_call: Optional[DecodedCall]  # decoded once, shared by all rules (None = no calldata or unknown selector)
    decode_error: Optional[str]          # set when the selector is registered but decoding failed

    def parsed_raw_data(self) -> Optional[Dict]:
        """The transaction's raw_data parsed as JSON (EIP-712 payloads), or None.

        raw_data also carries non-JSON personal_sign messages, so unparseable
        content is not an error — it just means no EIP-712 payload.
        """
        raw_data = self.transaction.get("raw_data")
        if not raw_data:
            return None
        try:
            parsed = json.loads(raw_data)
        except (json.JSONDecodeError, TypeError):
            return None
        return parsed if isinstance(parsed, dict) else None


Rule = Callable[[RuleContext], RuleResult]


def get_vault_address(transaction: Dict) -> str:
    """Resolve the address of the vault that signs this transaction."""
    from_field = transaction.get("from") or {}
    vault = from_field.get("vault") or {}
    if vault.get("address"):
        return vault["address"]
    managed = transaction.get("managed_transaction_data") or {}
    managed_vault = managed.get("vault") or {}
    if managed_vault.get("address"):
        return managed_vault["address"]
    return from_field.get("address") or ""


def run_rules(rules: List[Rule], context: RuleContext) -> RuleResult:
    """Run every rule; the first ABORT wins. A rule that raises is treated as ABORT (fail closed)."""
    for rule in rules:
        try:
            result = rule(context)
        except Exception as error:
            result = RuleResult.abort(f"rule {rule.__name__} raised: {error}")
            logger.exception("Rule %s raised an exception (failing closed)", rule.__name__)
        logger.info("[%s] %s: %s", rule.__name__, result.verdict.value, result.reason or "n/a")
        if result.verdict is Verdict.ABORT:
            return result
    return RuleResult.passed("all rules passed")
