from .base import RuleContext, RuleResult, get_vault_address


def _is_evm_address(value: str) -> bool:
    return value.lower().startswith("0x")


def validate_origin_vault(context: RuleContext) -> RuleResult:
    """Transactions must be signed by the configured origin vault.

    This rule exists because of how the runner resolves a verdict: rules are a
    deny-list layered on top of Fordefi Policy, and a transaction that no rule
    recognises reaches the end of the chain with every verdict SKIPPED — which the
    runner treats as an approval. A plain native-value transfer carries no calldata,
    no typed message and no instructions, so without this rule every other check
    skips and the approver rubber-stamps a transfer to any destination.

    Pinning the signing vault does not make the approver exhaustive, but it does mean
    it never votes on a transaction from a vault it was not configured to guard. Pair
    it with the strict-mode rule in the README if you want unrecognised calldata to
    abort as well.
    """
    vault_address = get_vault_address(context.transaction)
    if not vault_address:
        return RuleResult.abort("could not resolve the transaction's signing vault")

    origin_vault = context.config.origin_vault

    # ORIGIN_VAULT is a single address, so it can only be compared against a vault on
    # the same chain family. A Solana vault bridging to an EVM ORIGIN_VAULT (see
    # cctp_bridge_recipient) is the intended case: the destination is checked there.
    if _is_evm_address(vault_address) != _is_evm_address(origin_vault):
        return RuleResult.skipped(
            f"signing vault {vault_address} is on a different chain family than "
            f"ORIGIN_VAULT {origin_vault}"
        )

    if vault_address.lower() != origin_vault.lower():
        return RuleResult.abort(
            f"transaction is signed by vault {vault_address}, not the origin vault {origin_vault}"
        )
    return RuleResult.passed(f"signed by the origin vault {vault_address}")
