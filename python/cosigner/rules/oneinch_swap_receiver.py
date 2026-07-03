from .base import RuleContext, RuleResult
from .calldata import ONEINCH_SWAP_V6_SELECTOR

# Index of dstReceiver in the swap desc struct:
# (srcToken, dstToken, srcReceiver, dstReceiver, amount, minReturnAmount, flags)
DST_RECEIVER_INDEX = 3


def validate_oneinch_swap_receiver(context: RuleContext) -> RuleResult:
    """1inch swaps must pay out to the transaction initiator, not a third party.

    Decodes the swap desc struct from calldata (see rules/calldata.py) and checks the
    nested dstReceiver field — something Fordefi Policy cannot inspect natively.
    """
    hex_data = (context.transaction.get("hex_data") or "").lower()
    if not hex_data.startswith(ONEINCH_SWAP_V6_SELECTOR):
        return RuleResult.skipped("not a 1inch swap")

    if context.decode_error:
        return RuleResult.abort(context.decode_error)
    if context.decoded_call is None:
        return RuleResult.abort("1inch swap calldata could not be decoded")

    dst_receiver = context.decoded_call.args["desc"][DST_RECEIVER_INDEX]
    from_address = (context.transaction.get("from") or {}).get("address", "")
    if not from_address:
        return RuleResult.abort("transaction has no from address")

    if dst_receiver.lower() != from_address.lower():
        return RuleResult.abort(
            f"swap destination {dst_receiver} does not match initiator {from_address}"
        )
    return RuleResult.passed(f"swap destination {dst_receiver} matches initiator")
