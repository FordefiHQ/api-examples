import logging

from .base import RuleContext, RuleResult

logger = logging.getLogger("approver.rules")


def validate_calldata_contains_vault(context: RuleContext) -> RuleResult:
    """Contract calls must reference the origin vault somewhere in their calldata.

    A coarse but effective guard for swap/withdraw-style calls: if the vault address
    does not appear in the calldata, the funds are going somewhere else. ERC-20
    approvals are exempt — their calldata legitimately never contains the vault.

    Two limits worth knowing, since this rule reads stricter than it is:

    - It is a substring match. The vault appearing *anywhere* in the calldata satisfies
      it, including as an unrelated argument or inside a nested byte blob, so it does
      not prove the vault is the recipient. Use a decoding rule (see
      oneinch_swap_receiver) when you need to check a specific field.
    - The approval exemption means an unbounded `approve(spender, MAX_UINT)` passes
      unexamined. Restricting *who* may be approved belongs in a Fordefi Policy
      contract/dapp rule, or in a dedicated approver rule that decodes the spender.
    """
    hex_data = context.transaction.get("hex_data")
    if not hex_data:
        return RuleResult.skipped("no calldata")

    parsed_data = context.transaction.get("parsed_data") or {}
    if parsed_data.get("method") == "approve":
        # Logged at WARNING rather than left in a SKIPPED reason: this exemption waves
        # through the calldata shape most often used to drain a wallet, so it should be
        # visible in the audit log every time it is taken.
        logger.warning(
            "Skipping calldata check for an ERC-20 approval — spender is not validated here"
        )
        return RuleResult.skipped("ERC-20 approval")

    vault_bytes = context.config.origin_vault.lower().removeprefix("0x")
    if vault_bytes not in hex_data.lower():
        return RuleResult.abort("origin vault not found in transaction calldata")
    return RuleResult.passed("calldata contains the origin vault")
