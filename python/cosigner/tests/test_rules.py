import base64
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import eth_abi
import pytest
from eth_utils import function_signature_to_4byte_selector

from rules import (
    ALL_RULES,
    RuleContext,
    RuleResult,
    Verdict,
    decode_calldata,
    run_rules,
    validate_calldata_contains_vault,
    validate_cctp_bridge_recipient,
    validate_eip712_receiver,
    validate_oneinch_swap_receiver,
)
from rules.calldata import ABI_REGISTRY, ONEINCH_SWAP_V6_SELECTOR
from rules.cctp_bridge_recipient import (
    BURN_TOKEN_MINT_INDEX,
    CCTP_V2_TOKEN_MESSENGER,
    DEPOSIT_FOR_BURN_DISCRIMINATOR,
    USDC_MINT_SOLANA,
)

FIXTURES = Path(__file__).parent / "fixtures"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
VAULT = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73"
OTHER_ADDRESS = "0x1111111111111111111111111111111111111111"


def make_config(origin_vault: str = VAULT) -> SimpleNamespace:
    return SimpleNamespace(origin_vault=origin_vault, ZERO_ADDRESS=ZERO_ADDRESS)


def make_context(transaction: dict, origin_vault: str = VAULT) -> RuleContext:
    decoded_call, decode_error = decode_calldata(transaction.get("hex_data") or "")
    return RuleContext(
        transaction=transaction,
        config=make_config(origin_vault),
        decoded_call=decoded_call,
        decode_error=decode_error,
    )


@pytest.fixture
def contract_call_transaction() -> dict:
    with open(FIXTURES / "transaction_contract_call.json") as file:
        return json.load(file)


def oneinch_swap_calldata(dst_receiver: str) -> str:
    abi = ABI_REGISTRY[ONEINCH_SWAP_V6_SELECTOR]
    desc = (OTHER_ADDRESS, OTHER_ADDRESS, OTHER_ADDRESS, dst_receiver, 10**18, 10**17, 0)
    encoded = eth_abi.encode(list(abi.arg_types), [OTHER_ADDRESS, desc, b""])
    return ONEINCH_SWAP_V6_SELECTOR + encoded.hex()


class TestOnFixture:
    """Run against a real Uniswap UniversalRouter contract call (unknown selector)."""

    def test_all_rules_pass(self, contract_call_transaction):
        result = run_rules(ALL_RULES, make_context(contract_call_transaction))
        assert result.verdict is Verdict.PASSED

    def test_calldata_contains_vault_passes(self, contract_call_transaction):
        result = validate_calldata_contains_vault(make_context(contract_call_transaction))
        assert result.verdict is Verdict.PASSED

    def test_calldata_missing_vault_aborts(self, contract_call_transaction):
        context = make_context(contract_call_transaction, origin_vault=OTHER_ADDRESS)
        result = validate_calldata_contains_vault(context)
        assert result.verdict is Verdict.ABORT

    def test_other_rules_skip_contract_call(self, contract_call_transaction):
        context = make_context(contract_call_transaction)
        assert validate_eip712_receiver(context).verdict is Verdict.SKIPPED
        assert validate_oneinch_swap_receiver(context).verdict is Verdict.SKIPPED
        assert validate_cctp_bridge_recipient(context).verdict is Verdict.SKIPPED


class TestOneinchSwap:
    def test_selector_matches_signature(self):
        signature = "swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)"
        assert "0x" + function_signature_to_4byte_selector(signature).hex() == ONEINCH_SWAP_V6_SELECTOR

    def test_receiver_is_initiator_passes(self):
        transaction = {"hex_data": oneinch_swap_calldata(VAULT), "from": {"address": VAULT}}
        result = validate_oneinch_swap_receiver(make_context(transaction))
        assert result.verdict is Verdict.PASSED

    def test_receiver_is_third_party_aborts(self):
        transaction = {"hex_data": oneinch_swap_calldata(OTHER_ADDRESS), "from": {"address": VAULT}}
        result = validate_oneinch_swap_receiver(make_context(transaction))
        assert result.verdict is Verdict.ABORT

    def test_undecodable_calldata_fails_closed(self):
        truncated = oneinch_swap_calldata(VAULT)[:100]
        transaction = {"hex_data": truncated, "from": {"address": VAULT}}
        context = make_context(transaction)
        assert context.decode_error is not None
        assert validate_oneinch_swap_receiver(context).verdict is Verdict.ABORT


# Account pubkeys from the real bridge tx
# 5irhZRWPbzXzMY5tKpF36161uSYhrU7rPQqHw5prjytoqnTKjgrLvY4uTCCwBufeuwxEvTGTEtREvPD3awnKEP41
# (index 10 = burn_token_mint = USDC).
CCTP_ACCOUNTS = [
    "CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim",
    "CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim",
    "45hzrGLQ2EGo1Ln7QpXjDwb589GDQ9H2aEXXw6ds6BFE",
    "AcWj3Xgv1BFofqMsrw2dwwqr5b43qmjXJ42Sb1j91HwN",
    "3ekNGsoYbKFbqJksFyRDMDvYrDtGn1oRTiMwsUgKUisA",
    "W1k5ijkaSTo5iA5zChNpfzcy796fLhkBxfmJuR8W8HU",
    "AawthJCGRmggpfv9MMWV6Jmo9cue4gL9wUZgRBShg58W",
    "3EzN2mcmdfSNGXRCAixSpTteK6ywdmFDZZWvkMnznFt9",
    "E1bQJ8eMMn3zmeSewW3HQ8zmJr7KR75JonbwAtWx2bux",
    "CRBBbuLCyrkQy4dCTHxqstSmDQv4ajBeUVb9qUdMVaP1",
    USDC_MINT_SOLANA,
    "DoEE4r51Z8zkDacGFnzn2ibtcVxUoGjzYfrDPp6rned3",
]


def deposit_for_burn_data(recipient: str, destination_domain: int = 0) -> bytes:
    mint_recipient = b"\x00" * 12 + bytes.fromhex(recipient.removeprefix("0x"))
    return (
        DEPOSIT_FOR_BURN_DISCRIMINATOR
        + (999900).to_bytes(8, "little")               # amount
        + destination_domain.to_bytes(4, "little")
        + mint_recipient
        + b"\x00" * 32                                 # destination_caller
        + (100).to_bytes(8, "little")                  # max_fee
        + (1000).to_bytes(4, "little")                 # min_finality_threshold
    )


def cctp_transaction(data: bytes, accounts: list | None = None) -> dict:
    accounts = accounts if accounts is not None else CCTP_ACCOUNTS
    return {
        "type": "solana_transaction",
        "accounts": [{"address": {"address": pubkey}} for pubkey in accounts],
        "instructions": [
            {
                "program": {"address": CCTP_V2_TOKEN_MESSENGER},
                "data": base64.b64encode(data).decode(),
                "account_indexes": list(range(len(accounts))),
            }
        ],
    }


class TestCctpBridge:
    def test_discriminator_matches_anchor_sighash(self):
        assert DEPOSIT_FOR_BURN_DISCRIMINATOR == hashlib.sha256(b"global:deposit_for_burn").digest()[:8]

    def test_recipient_is_origin_vault_passes(self):
        result = validate_cctp_bridge_recipient(make_context(cctp_transaction(deposit_for_burn_data(VAULT))))
        assert result.verdict is Verdict.PASSED

    def test_recipient_is_third_party_aborts(self):
        result = validate_cctp_bridge_recipient(
            make_context(cctp_transaction(deposit_for_burn_data(OTHER_ADDRESS)))
        )
        assert result.verdict is Verdict.ABORT

    def test_non_ethereum_domain_aborts(self):
        result = validate_cctp_bridge_recipient(
            make_context(cctp_transaction(deposit_for_burn_data(VAULT, destination_domain=6)))
        )
        assert result.verdict is Verdict.ABORT

    def test_truncated_data_fails_closed(self):
        result = validate_cctp_bridge_recipient(
            make_context(cctp_transaction(deposit_for_burn_data(VAULT)[:40]))
        )
        assert result.verdict is Verdict.ABORT

    def test_unknown_cctp_instruction_fails_closed(self):
        data = b"\xff" * 8 + deposit_for_burn_data(VAULT)[8:]
        result = validate_cctp_bridge_recipient(make_context(cctp_transaction(data)))
        assert result.verdict is Verdict.ABORT

    def test_non_usdc_burn_aborts(self):
        accounts = list(CCTP_ACCOUNTS)
        accounts[BURN_TOKEN_MINT_INDEX] = OTHER_ADDRESS
        result = validate_cctp_bridge_recipient(
            make_context(cctp_transaction(deposit_for_burn_data(VAULT), accounts))
        )
        assert result.verdict is Verdict.ABORT

    def test_solana_transaction_without_cctp_skips(self):
        transaction = {
            "type": "solana_transaction",
            "accounts": [],
            "instructions": [{"program": {"address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}}],
        }
        result = validate_cctp_bridge_recipient(make_context(transaction))
        assert result.verdict is Verdict.SKIPPED


class TestEip712Receiver:
    def eip712_transaction(self, receiver: str) -> dict:
        return {"raw_data": json.dumps({"message": {"receiver": receiver}})}

    def test_receiver_is_vault_passes(self):
        result = validate_eip712_receiver(make_context(self.eip712_transaction(VAULT)))
        assert result.verdict is Verdict.PASSED

    def test_receiver_is_zero_address_passes(self):
        result = validate_eip712_receiver(make_context(self.eip712_transaction(ZERO_ADDRESS)))
        assert result.verdict is Verdict.PASSED

    def test_receiver_is_third_party_aborts(self):
        result = validate_eip712_receiver(make_context(self.eip712_transaction(OTHER_ADDRESS)))
        assert result.verdict is Verdict.ABORT

    def test_non_json_raw_data_skips(self):
        result = validate_eip712_receiver(make_context({"raw_data": "hello, sign me"}))
        assert result.verdict is Verdict.SKIPPED


class TestRunner:
    def test_raising_rule_fails_closed(self):
        def exploding_rule(context: RuleContext) -> RuleResult:
            raise KeyError("boom")

        result = run_rules([exploding_rule], make_context({}))
        assert result.verdict is Verdict.ABORT
        assert "exploding_rule" in result.reason

    def test_abort_short_circuits(self):
        calls = []

        def aborting_rule(context):
            calls.append("abort")
            return RuleResult.abort("nope")

        def later_rule(context):
            calls.append("later")
            return RuleResult.passed()

        result = run_rules([aborting_rule, later_rule], make_context({}))
        assert result.verdict is Verdict.ABORT
        assert calls == ["abort"]
