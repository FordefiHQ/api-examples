from .base import RuleContext, RuleResult


def validate_calldata_contains_vault(context: RuleContext) -> RuleResult:
    """Contract calls must reference the origin vault somewhere in their calldata.

    A coarse but effective guard for swap/withdraw-style calls: if the vault address
    does not appear in the calldata, the funds are going somewhere else. ERC-20
    approvals are exempt — their calldata legitimately never contains the vault.
    """
    hex_data = context.transaction.get("hex_data")
    if not hex_data:
        return RuleResult.skipped("no calldata")

    parsed_data = context.transaction.get("parsed_data") or {}
    if parsed_data.get("method") == "approve":
        return RuleResult.skipped("ERC-20 approval")

    vault_bytes = context.config.origin_vault.lower().removeprefix("0x")
    if vault_bytes not in hex_data.lower():
        return RuleResult.abort("origin vault not found in transaction calldata")
    return RuleResult.passed("calldata contains the origin vault")
