from .base import RuleContext, RuleResult


def validate_eip712_receiver(context: RuleContext) -> RuleResult:
    """EIP-712 orders must pay out to the origin vault (or the zero address placeholder).

    Fordefi Policy can restrict who may sign a typed message, but not the value of a
    nested field inside it — this rule inspects `message.receiver` directly.
    """
    typed_message = context.parsed_raw_data()
    if typed_message is None:
        return RuleResult.skipped("no EIP-712 payload")

    message = typed_message.get("message") or {}
    receiver = message.get("receiver")
    if receiver is None:
        return RuleResult.skipped("EIP-712 message has no receiver field")

    allowed = {context.config.origin_vault.lower(), context.config.ZERO_ADDRESS.lower()}
    if str(receiver).lower() not in allowed:
        return RuleResult.abort(f"EIP-712 receiver {receiver} is not the origin vault")
    return RuleResult.passed(f"EIP-712 receiver {receiver} allowed")
