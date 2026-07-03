from .base import Rule, RuleContext, RuleResult, Verdict, get_vault_address, run_rules
from .calldata import ABI_REGISTRY, DecodedCall, decode_calldata
from .calldata_contains_vault import validate_calldata_contains_vault
from .cctp_bridge_recipient import validate_cctp_bridge_recipient
from .eip712_receiver import validate_eip712_receiver
from .oneinch_swap_receiver import validate_oneinch_swap_receiver

# The rules the CoSigner runs on every transaction awaiting approval.
# To add your own check: write a function taking a RuleContext and returning a
# RuleResult (see any rule module for an example), then append it here.
ALL_RULES: list[Rule] = [
    validate_eip712_receiver,
    validate_calldata_contains_vault,
    validate_oneinch_swap_receiver,
    validate_cctp_bridge_recipient,
]
