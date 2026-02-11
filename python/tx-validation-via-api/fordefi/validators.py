import json
import subprocess
from typing import Dict


class TransactionAbortError(Exception):
    pass


class TransactionValidator:
    def __init__(self, origin_vault: str, zero_address: str):
        self.origin_vault = origin_vault.lower()
        self.zero_address = zero_address.lower()

    def validate(self, transaction_data: Dict) -> None:
        self._log_transaction_details(transaction_data)
        self._validate_eip712_receiver(transaction_data)
        self._validate_hyperliquid_destination(transaction_data)
        self._validate_calldata_contains_vault(transaction_data)
        self._validate_swap_destination(transaction_data)
        print("✅ All validations passed")

    def _log_transaction_details(self, transaction_data: Dict) -> None:
        from_address = transaction_data.get('from', {}).get('address', 'unknown')
        to_address = transaction_data.get('to', {}).get('address', 'unknown')
        value = transaction_data.get('value', 'unknown')
        chain = transaction_data.get('chain', {}).get('name', 'unknown')

        print(f"Validating transaction: from={from_address}, to={to_address}, value={value}, chain={chain}")

    def _validate_eip712_receiver(self, transaction_data: Dict) -> None:
        raw_data = transaction_data.get("raw_data")
        if not raw_data or not isinstance(raw_data, str):
            return

        try:
            parsed_eip712 = json.loads(raw_data)
            message = parsed_eip712.get("message", {})
            receiver = message.get("receiver", "").lower()

            if not receiver:
                return

            receiver_is_zero_address = receiver == self.zero_address
            receiver_is_origin_vault = receiver == self.origin_vault

            if not receiver_is_zero_address and not receiver_is_origin_vault:
                raise TransactionAbortError(f"❌ Unauthorized EIP-712 receiver: {receiver}")

            print(f"✅ EIP-712 receiver validated: {receiver}")

        except json.JSONDecodeError:
            pass
        except TransactionAbortError:
            raise

    def _validate_hyperliquid_destination(self, transaction_data: Dict) -> None:
        raw_data = transaction_data.get("raw_data")
        if not raw_data or not isinstance(raw_data, str):
            return

        try:
            parsed_eip712 = json.loads(raw_data)
            domain = parsed_eip712.get("domain", {})

            if domain.get("name") != "HyperliquidSignTransaction":
                return

            message = parsed_eip712.get("message", {})

            print(f"  Hyperliquid message detected: primaryType={parsed_eip712.get('primaryType', 'unknown')}, type={message.get('type', 'unknown')}")

            destination = message.get("destination", "").lower()

            print(f"  Hyperliquid destination field: {destination or '(empty)'}")

            if not destination:
                print("  ⚠️ No destination in Hyperliquid message, skipping validation")
                return

            signer_address = self._get_signer_address(transaction_data)
            if not signer_address:
                print("  ⚠️ No signer address resolved, skipping Hyperliquid destination validation")
                return

            if destination != signer_address:
                raise TransactionAbortError(
                    f"❌ Hyperliquid destination {destination} does not match signer {signer_address}"
                )

            print(f"✅ Hyperliquid destination validated: {destination}")

        except json.JSONDecodeError:
            pass
        except TransactionAbortError:
            raise

    def _validate_calldata_contains_vault(self, transaction_data: Dict) -> None:
        hex_data = transaction_data.get("hex_data")
        if not hex_data:
            return

        if self._is_approval_transaction(transaction_data):
            return

        decoded_calldata = self._decode_calldata_with_cast(hex_data)

        if self.origin_vault not in decoded_calldata.lower():
            raise TransactionAbortError("❌ Origin vault not found in transaction calldata")

        print("✅ Calldata contains origin vault")

    def _is_approval_transaction(self, transaction_data: Dict) -> bool:
        parsed_data = transaction_data.get("parsed_data", {})
        return parsed_data.get("method") == "approve"

    def _get_signer_address(self, transaction_data: Dict) -> str:
        from_obj = transaction_data.get("from", {})
        vault_obj = transaction_data.get("vault", {})
        sender_obj = transaction_data.get("sender", {})

        from_address = from_obj.get("address", "") if isinstance(from_obj, dict) else ""
        vault_address = vault_obj.get("address", "") if isinstance(vault_obj, dict) else ""
        sender_address = sender_obj.get("address", "") if isinstance(sender_obj, dict) else ""

        print(f"  Signer address lookup: from={from_address or '(empty)'}, vault={vault_address or '(empty)'}, sender={sender_address or '(empty)'}")

        if vault_address:
            print(f"  Signer vault address: {vault_address}")
            return vault_address.lower()

        print("  ⚠️ No signer address found in from/vault/sender fields")
        return ""

    def _decode_calldata_with_cast(self, hex_data: str) -> str:
        try:
            result = subprocess.run(
                ["cast", "4byte-decode", hex_data],
                capture_output=True,
                text=True
            )
            return result.stdout or ""
        except subprocess.SubprocessError as error:
            raise TransactionAbortError(f"❌ Failed to decode calldata: {error}")

    def _validate_swap_destination(self, transaction_data: Dict) -> None:
        hex_data = transaction_data.get("hex_data")
        if not hex_data:
            return

        decoded = self._decode_calldata_with_cast(hex_data)
        if "swap(" not in decoded:
            return

        from_address = transaction_data.get("from", {}).get("address", "").lower()
        if not from_address:
            return

        dst_receiver = self._extract_swap_dst_receiver(decoded)
        if not dst_receiver:
            return

        if dst_receiver.lower() != from_address:
            raise TransactionAbortError(
                f"❌ Swap destination {dst_receiver} does not match initiator {from_address}"
            )

        print(f"✅ Swap destination validated: {dst_receiver}")

    def _extract_swap_dst_receiver(self, decoded_calldata: str) -> str:
        import re
        address_pattern = r"0x[a-fA-F0-9]{40}"
        addresses = re.findall(address_pattern, decoded_calldata)
        # In 1inch swap struct: srcToken, dstToken, srcReceiver, dstReceiver (4th address in tuple)
        # First address is the executor param, then the tuple addresses follow
        if len(addresses) >= 5:
            return addresses[4]  # dstReceiver is the 5th address found (index 4)
        return ""
