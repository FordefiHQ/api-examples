from .base import Rule, RuleContext, RuleResult, Verdict, get_vault_address, run_rules
from .calldata import ABI_REGISTRY, DecodedCall, decode_calldata
from .calldata_contains_vault import validate_calldata_contains_vault
from .cctp_bridge_recipient import validate_cctp_bridge_recipient
from .eip712_receiver import validate_eip712_receiver
from .oneinch_swap_receiver import validate_oneinch_swap_receiver
from .origin_vault import validate_origin_vault

# The rules the API Approver runs on every transaction awaiting approval.
# To add your own check: write a function taking a RuleContext and returning a
# RuleResult (see any rule module for an example), then append it here.
#
# These rules are a deny-list on top of Fordefi Policy: a transaction that every rule
# SKIPS is approved. validate_origin_vault runs first so that a transaction no other
# rule recognises is at least pinned to the vault this approver guards.
ALL_RULES: list[Rule] = [
    validate_origin_vault,
    validate_eip712_receiver,
    validate_calldata_contains_vault,
    validate_oneinch_swap_receiver,
    validate_cctp_bridge_recipient,
]
