import os
import json
import struct
import requests
import binascii
from io import BytesIO
from dotenv import load_dotenv
from bitcoin import SelectParams
from typing import List, Optional, Tuple
from bitcoin.wallet import CBitcoinAddress
from bitcoin.core import CTransaction, CTxIn, CTxOut, COutPoint, lx
from bitcoin.core.script import CScript

load_dotenv()


def bech32_polymod(values):
    """Compute the Bech32 checksum polymod"""
    GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for value in values:
        b = chk >> 25
        chk = (chk & 0x1ffffff) << 5 ^ value
        for i in range(5):
            chk ^= GEN[i] if ((b >> i) & 1) else 0
    return chk


def bech32_hrp_expand(hrp):
    """Expand the HRP for Bech32 checksum computation"""
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]


def bech32_verify_checksum(hrp, data, const):
    """Verify a Bech32/Bech32m checksum"""
    return bech32_polymod(bech32_hrp_expand(hrp) + data) == const


def bech32_decode(bech):
    """Decode a Bech32/Bech32m string"""
    CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    BECH32_CONST = 1
    BECH32M_CONST = 0x2bc830a3

    if ((any(ord(x) < 33 or ord(x) > 126 for x in bech)) or
            (bech.lower() != bech and bech.upper() != bech)):
        return (None, None, None)
    bech = bech.lower()
    pos = bech.rfind('1')
    if pos < 1 or pos + 7 > len(bech) or len(bech) > 90:
        return (None, None, None)
    if not all(x in CHARSET for x in bech[pos+1:]):
        return (None, None, None)
    hrp = bech[:pos]
    data = [CHARSET.find(x) for x in bech[pos+1:]]

    encoding = None
    if bech32_verify_checksum(hrp, data, BECH32M_CONST):
        encoding = 'bech32m'
    elif bech32_verify_checksum(hrp, data, BECH32_CONST):
        encoding = 'bech32'
    else:
        return (None, None, None)

    return (hrp, data[:-6], encoding)


def convertbits(data, frombits, tobits, pad=True):
    """Convert between bit groups"""
    acc = 0
    bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    max_acc = (1 << (frombits + tobits - 1)) - 1
    for value in data:
        if value < 0 or (value >> frombits):
            return None
        acc = ((acc << frombits) | value) & max_acc
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad:
        if bits:
            ret.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        return None
    return ret


def is_legacy_address(address: str) -> bool:
    """Check if an address is a legacy Bitcoin address (P2PKH or P2SH)."""
    if not address:
        return False
    legacy_prefixes = ('1', '3', 'm', 'n', '2')
    return address[0] in legacy_prefixes


def address_to_scriptpubkey(address: str) -> bytes:
    """
    Convert any Bitcoin address to its scriptPubKey.
    Supports Legacy (P2PKH, P2SH), SegWit v0 (P2WPKH, P2WSH), and Taproot (P2TR).
    """
    hrp, data, encoding = bech32_decode(address)

    if hrp is not None and data is not None:
        decoded = convertbits(data[1:], 5, 8, False)
        if decoded is None or len(decoded) < 2 or len(decoded) > 40:
            raise ValueError(f"Invalid Bech32 address: {address}")

        witness_version = data[0]
        witness_program = bytes(decoded)

        if encoding == 'bech32' and witness_version != 0:
            raise ValueError(f"Bech32 encoding only valid for witness version 0")
        if encoding == 'bech32m' and witness_version == 0:
            raise ValueError(f"Bech32m encoding not valid for witness version 0")

        if witness_version == 0:
            script = bytes([0x00, len(witness_program)]) + witness_program
        else:
            version_opcode = 0x50 + witness_version
            script = bytes([version_opcode, len(witness_program)]) + witness_program

        return script
    else:
        try:
            addr = CBitcoinAddress(address)
            return bytes(addr.to_scriptPubKey())  # type: ignore[attr-defined]
        except Exception as e:
            raise ValueError(f"Invalid Bitcoin address: {address}") from e


class UTXO:
    """Class to represent a UTXO"""
    def __init__(self, txid: str, vout: int, value: int, script_pub_key: str):
        self.txid = txid
        self.vout = vout
        self.value = value
        self.script_pub_key = script_pub_key

    def __repr__(self):
        return f"UTXO(txid={self.txid[:8]}..., vout={self.vout}, value={self.value})"


class Recipient:
    """Class to represent a transaction recipient"""
    def __init__(self, address: str, amount: int):
        self.address = address
        self.amount = amount

    def __repr__(self):
        return f"Recipient(address={self.address}, amount={self.amount})"


def fetch_utxos(address: str, network: str = "testnet4") -> List[UTXO]:
    """
    Fetch UTXOs for a given address using public APIs.
    Uses mempool.space for testnet4, Blockstream for mainnet/testnet3.
    """
    base_urls = {
        "mainnet": "https://blockstream.info/api",
        "testnet": "https://blockstream.info/testnet/api",
        "testnet3": "https://blockstream.info/testnet/api",
        "testnet4": "https://mempool.space/testnet4/api"
    }

    if network not in base_urls:
        raise ValueError(f"Network must be 'mainnet', 'testnet', 'testnet3', or 'testnet4', got: {network}")

    base_url = base_urls[network]

    print(f"Fetching UTXOs for address: {address} on {network}...")

    try:
        response = requests.get(f"{base_url}/address/{address}/utxo", timeout=10)
        response.raise_for_status()

        utxos_data = response.json()

        if not utxos_data:
            print(f"No UTXOs found for address {address}")
            return []

        utxos = []
        for utxo_data in utxos_data:
            tx_response = requests.get(f"{base_url}/tx/{utxo_data['txid']}", timeout=10)
            tx_response.raise_for_status()
            tx_data = tx_response.json()

            vout_data = tx_data['vout'][utxo_data['vout']]

            utxo = UTXO(
                txid=utxo_data['txid'],
                vout=utxo_data['vout'],
                value=utxo_data['value'],
                script_pub_key=vout_data['scriptpubkey']
            )
            utxos.append(utxo)

        print(f"Found {len(utxos)} UTXO(s)")
        for i, utxo in enumerate(utxos, 1):
            print(f"  {i}. {utxo.txid}:{utxo.vout} - {utxo.value} satoshis")

        return utxos

    except requests.exceptions.RequestException as e:
        print(f"Error fetching UTXOs: {e}")
        return []


def select_utxos_for_amount(utxos: List[UTXO], target_amount: int, fee: int) -> Optional[List[UTXO]]:
    """
    Simple UTXO selection: pick smallest UTXOs that cover the target amount + fee.
    """
    sorted_utxos = sorted(utxos, key=lambda u: u.value)

    selected = []
    total = 0
    needed = target_amount + fee

    for utxo in sorted_utxos:
        selected.append(utxo)
        total += utxo.value
        if total >= needed:
            break

    if total < needed:
        print(f"Insufficient funds: have {total}, need {needed}")
        return None

    return selected


def is_taproot_output(script_pubkey: bytes) -> bool:
    """Check if a scriptPubKey is a Taproot output (OP_1 <32 bytes>)"""
    return len(script_pubkey) == 34 and script_pubkey[0] == 0x51 and script_pubkey[1] == 0x20


def create_psbt_hex(tx: CTransaction, utxos: List[UTXO]) -> str:
    """
    Create a PSBT (BIP 174/371) from an unsigned transaction and UTXOs.
    Supports Legacy, SegWit v0, and Taproot inputs.
    """
    psbt = BytesIO()

    # Magic bytes and separator
    psbt.write(b'\x70\x73\x62\x74\xff')

    # Global: unsigned transaction
    psbt.write(b'\x01\x00')
    tx_bytes = tx.serialize()
    psbt.write(compact_size(len(tx_bytes)))
    psbt.write(tx_bytes)

    # End global section
    psbt.write(b'\x00')

    # Input sections
    for utxo in utxos:
        # PSBT_IN_WITNESS_UTXO (0x01)
        psbt.write(b'\x01\x01')

        script_bytes = bytes.fromhex(utxo.script_pub_key)
        witness_utxo = CTxOut(utxo.value, CScript(script_bytes))
        utxo_bytes = witness_utxo.serialize()

        psbt.write(compact_size(len(utxo_bytes)))
        psbt.write(utxo_bytes)

        # For Taproot inputs, add the internal key (BIP 371)
        if is_taproot_output(script_bytes):
            internal_key = script_bytes[2:]
            psbt.write(b'\x01\x17')
            psbt.write(compact_size(len(internal_key)))
            psbt.write(internal_key)

        psbt.write(b'\x00')

    # Output sections
    for _ in tx.vout:
        psbt.write(b'\x00')

    return psbt.getvalue().hex()


def compact_size(n: int) -> bytes:
    """Encode a number as Bitcoin compact size."""
    if n < 0xfd:
        return bytes([n])
    elif n <= 0xffff:
        return b'\xfd' + struct.pack('<H', n)
    elif n <= 0xffffffff:
        return b'\xfe' + struct.pack('<I', n)
    else:
        return b'\xff' + struct.pack('<Q', n)


def create_psbt_from_utxos_multi(
    sender_address: str,
    recipients: List[Recipient],
    fee: int,
    network: str = "testnet4"
) -> Optional[Tuple[str, CTransaction]]:
    """
    Create a PSBT with multiple recipients using real UTXOs fetched from the blockchain.

    Args:
        sender_address: Address to spend from
        recipients: List of Recipient objects (address + amount pairs)
        fee: Transaction fee in satoshis
        network: 'mainnet', 'testnet', 'testnet3', or 'testnet4'

    Returns:
        Tuple of (PSBT hex string, unsigned transaction) or None if failed
    """
    SelectParams('testnet' if network in ('testnet', 'testnet3', 'testnet4') else 'mainnet')

    total_send_amount = sum(r.amount for r in recipients)

    print("=== Bitcoin PSBT Construction (Multi-Recipient) ===\n")
    print(f"Number of recipients: {len(recipients)}")
    print(f"Total send amount: {total_send_amount} satoshis ({total_send_amount / 100000000:.8f} BTC)\n")

    # Fetch UTXOs
    utxos = fetch_utxos(sender_address, network)

    if not utxos:
        print("No UTXOs available. Cannot create transaction.")
        return None

    # Select UTXOs
    selected_utxos = select_utxos_for_amount(utxos, total_send_amount, fee)

    if not selected_utxos:
        return None

    # Calculate change
    input_total = sum(utxo.value for utxo in selected_utxos)
    change_amount = input_total - total_send_amount - fee

    print(f"\n=== Transaction Summary ===")
    print(f"Sender: {sender_address}")
    for i, r in enumerate(recipients, 1):
        print(f"Recipient {i}: {r.address} -> {r.amount} satoshis ({r.amount / 100000000:.8f} BTC)")
    print(f"Fee: {fee} satoshis ({fee / 100000000:.8f} BTC)")
    print(f"Change: {change_amount} satoshis ({change_amount / 100000000:.8f} BTC)")
    print(f"Total input: {input_total} satoshis")
    print(f"Using {len(selected_utxos)} UTXO(s)\n")

    # Create transaction inputs
    txins = []
    for utxo in selected_utxos:
        txin = CTxIn(COutPoint(lx(utxo.txid), utxo.vout))
        txins.append(txin)

    # Create transaction outputs
    txouts = []

    # One output per recipient
    for r in recipients:
        scriptPubKey = address_to_scriptpubkey(r.address)
        txout = CTxOut(r.amount, CScript(scriptPubKey))
        txouts.append(txout)

    # Change output
    if change_amount > 0:
        sender_scriptPubKey = address_to_scriptpubkey(sender_address)
        txout_change = CTxOut(change_amount, CScript(sender_scriptPubKey))
        txouts.append(txout_change)

    # Create the transaction
    tx = CTransaction(vin=txins, vout=txouts)

    print("=== Unsigned Transaction Created ===")
    tx_hex = binascii.hexlify(tx.serialize()).decode()
    print(f"Transaction hex ({len(tx_hex)} chars):")
    print(f"{tx_hex[:100]}...")
    print(f"\nTransaction ID (will change after signing): {tx.GetTxid()}")

    print("\n=== UTXO Details for Signing ===")
    for i, utxo in enumerate(selected_utxos):
        print(f"Input {i}:")
        print(f"  TXID: {utxo.txid}")
        print(f"  VOUT: {utxo.vout}")
        print(f"  Value: {utxo.value} satoshis")
        print(f"  ScriptPubKey: {utxo.script_pub_key}")

    # Generate PSBT
    print("\n=== Generating PSBT ===")
    psbt_hex = create_psbt_hex(tx, selected_utxos)
    print(f"PSBT hex ({len(psbt_hex)} chars):")
    print(f"{psbt_hex}\n")

    return psbt_hex, tx


def parse_recipients(recipients_json: str) -> List[Recipient]:
    """
    Parse recipients from a JSON string.

    Expected format:
        [
            {"address": "tb1q...", "amount": 50000},
            {"address": "tb1p...", "amount": 30000}
        ]

    Args:
        recipients_json: JSON string with recipient list

    Returns:
        List of Recipient objects
    """
    try:
        data = json.loads(recipients_json)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in BTC_RECIPIENTS: {e}")

    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("BTC_RECIPIENTS must be a non-empty JSON array")

    recipients = []
    for i, entry in enumerate(data):
        if not isinstance(entry, dict):
            raise ValueError(f"Recipient {i} must be a JSON object")
        if "address" not in entry or "amount" not in entry:
            raise ValueError(f"Recipient {i} must have 'address' and 'amount' fields")

        address = entry["address"]
        amount = int(entry["amount"])

        if amount <= 0:
            raise ValueError(f"Recipient {i} amount must be positive, got {amount}")

        recipients.append(Recipient(address=address, amount=amount))

    return recipients


def main():
    sender_address = os.getenv('BTC_SENDER_ADDRESS_TESTNET_V4')
    recipients_file = os.getenv('BTC_RECIPIENTS_FILE', 'recipients.json')
    fee = os.getenv('BTC_FEE', '200')
    network = os.getenv('BTC_NETWORK', 'testnet4')

    if not sender_address:
        print("Error: BTC_SENDER_ADDRESS_TESTNET_V4 environment variable not set")
        print("\nExample usage:")
        print("export BTC_SENDER_ADDRESS_TESTNET_V4='tb1q...'")
        print("export BTC_RECIPIENTS_FILE='recipients.json'  # optional, default: recipients.json")
        print("export BTC_FEE='1000'  # optional, in satoshis")
        print("export BTC_NETWORK='testnet4'  # or 'mainnet', 'testnet3'")
        return

    try:
        with open(recipients_file, 'r') as f:
            recipients_json = f.read()
        print(f"Loaded recipients from {recipients_file}")
    except FileNotFoundError:
        print(f"Error: Recipients file not found: {recipients_file}")
        print("Create a JSON file with recipient entries (see recipients_example.json)")
        return

    if is_legacy_address(sender_address):
        print("Error: BTC_SENDER_ADDRESS cannot be a legacy address")
        print("Legacy addresses (starting with '1', '3', 'm', 'n', or '2') are not supported by Fordefi.")
        print("Please use a SegWit (bc1q/tb1q) or Taproot (bc1p/tb1p) address instead.")
        print(f"Provided address: {sender_address}")
        return

    try:
        recipients = parse_recipients(recipients_json)
    except ValueError as e:
        print(f"Error parsing recipients: {e}")
        return

    try:
        fee = int(fee)
    except ValueError:
        print("Error: BTC_FEE must be an integer (satoshis)")
        return

    if fee < 0:
        print("Error: BTC_FEE cannot be negative")
        return

    print(f"Parsed {len(recipients)} recipient(s):")
    for i, r in enumerate(recipients, 1):
        print(f"  {i}. {r.address} -> {r.amount} satoshis")
    print()

    result = create_psbt_from_utxos_multi(
        sender_address=sender_address,
        recipients=recipients,
        fee=fee,
        network=network
    )

    if result:
        psbt_hex, _ = result
        print("\n✓ PSBT construction successful!")

        output_file = "psbt_output.txt"
        with open(output_file, 'w') as f:
            f.write(f"0x{psbt_hex}")
        print(f"\n📄 PSBT saved to: {output_file}")

        print("\nTo use with the Fordefi API, set the environment variable:")
        print(f'PSBT_HEX_DATA="0x{psbt_hex}"')
        print("\nThen run: python psbt.py")
    else:
        print("\n✗ PSBT construction failed.")


if __name__ == "__main__":
    main()
