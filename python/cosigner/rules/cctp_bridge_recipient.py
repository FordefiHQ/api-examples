import base64

from .base import RuleContext, RuleResult

# Circle CCTP V2 TokenMessengerMinter program on Solana mainnet.
CCTP_V2_TOKEN_MESSENGER = "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe"

# Anchor instruction discriminator: sha256(b"global:deposit_for_burn")[:8]
DEPOSIT_FOR_BURN_DISCRIMINATOR = bytes.fromhex("d73c3d2e723780b0")

# DepositForBurnParams layout after the discriminator (little-endian ints):
#   amount u64 | destination_domain u32 | mint_recipient 32B | destination_caller 32B
#   | max_fee u64 | min_finality_threshold u32
DEPOSIT_FOR_BURN_DATA_LENGTH = 96
ETHEREUM_DOMAIN = 0

USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
# Position of burn_token_mint in the instruction's accounts (DepositForBurnContext order).
BURN_TOKEN_MINT_INDEX = 10


def validate_cctp_bridge_recipient(context: RuleContext) -> RuleResult:
    """Solana→Ethereum CCTP USDC bridges must mint to the origin vault.

    The bridge recipient lives inside borsh-encoded Solana instruction data —
    invisible to native Policy rules. This rule decodes every depositForBurn
    instruction and checks that the funds land back in our own EVM vault.
    """
    transaction = context.transaction
    if transaction.get("type") != "solana_transaction":
        return RuleResult.skipped("not a Solana transaction")

    cctp_instructions = [
        instruction
        for instruction in transaction.get("instructions") or []
        if (instruction.get("program") or {}).get("address") == CCTP_V2_TOKEN_MESSENGER
    ]
    if not cctp_instructions:
        return RuleResult.skipped("no CCTP instructions")

    expected_recipient = b"\x00" * 12 + bytes.fromhex(context.config.origin_vault.removeprefix("0x"))

    for instruction in cctp_instructions:
        data = base64.b64decode(instruction.get("data") or "")

        if data[:8] != DEPOSIT_FOR_BURN_DISCRIMINATOR:
            return RuleResult.abort(f"unrecognized CCTP instruction (discriminator {data[:8].hex()})")
        if len(data) != DEPOSIT_FOR_BURN_DATA_LENGTH:
            return RuleResult.abort(f"unexpected depositForBurn data length {len(data)}")

        destination_domain = int.from_bytes(data[16:20], "little")
        mint_recipient = data[20:52]

        if destination_domain != ETHEREUM_DOMAIN:
            return RuleResult.abort(f"bridge destination domain {destination_domain} is not Ethereum")

        if mint_recipient != expected_recipient:
            return RuleResult.abort(
                f"bridge recipient 0x{mint_recipient[12:].hex()} is not the origin vault "
                f"{context.config.origin_vault}"
            )

        account_indexes = instruction.get("account_indexes") or []
        accounts = transaction.get("accounts") or []
        if len(account_indexes) <= BURN_TOKEN_MINT_INDEX:
            return RuleResult.abort("depositForBurn instruction has too few accounts")
        mint_account = accounts[account_indexes[BURN_TOKEN_MINT_INDEX]]
        mint_address = (mint_account.get("address") or {}).get("address")
        if mint_address != USDC_MINT_SOLANA:
            return RuleResult.abort(f"burned token {mint_address} is not USDC")

    return RuleResult.passed("all CCTP bridges mint USDC to the origin vault on Ethereum")
