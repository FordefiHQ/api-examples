import os
import struct
import requests
import binascii
from io import BytesIO
from dotenv import load_dotenv
from bitcoin import SelectParams
from typing import List, Optional
from bitcoin.wallet import CBitcoinAddress
from bitcoin.core.script import CScript, OP_1
from bitcoin.core import CTransaction, CTxIn, CTxOut, COutPoint, lx

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

    # Try Bech32m first (for Taproot), then Bech32 (for SegWit v0)
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
    """
    Check if an address is a legacy Bitcoin address (P2PKH or P2SH).
    Legacy addresses start with '1', '3' (mainnet) or 'm', 'n', '2' (testnet).

    Args:
        address: Bitcoin address string

    Returns:
        True if the address is a legacy address, False otherwise
    """
    if not address:
        return False

    # Legacy address prefixes
    legacy_prefixes = ('1', '3', 'm', 'n', '2')
    return address[0] in legacy_prefixes


def address_to_scriptpubkey(address: str) -> bytes:
    """
    Convert any Bitcoin address to its scriptPubKey.
    Supports Legacy (P2PKH, P2SH), SegWit v0 (P2WPKH, P2WSH), and Taproot (P2TR).

    Args:
        address: Bitcoin address string

    Returns:
        scriptPubKey as bytes
    """
    # Try to decode as Bech32/Bech32m (SegWit v0 or Taproot)
    hrp, data, encoding = bech32_decode(address)

    if hrp is not None and data is not None:
        # It's a Bech32/Bech32m address
        decoded = convertbits(data[1:], 5, 8, False)
        if decoded is None or len(decoded) < 2 or len(decoded) > 40:
            raise ValueError(f"Invalid Bech32 address: {address}")

        witness_version = data[0]
        witness_program = bytes(decoded)

        # Validate based on encoding type
        if encoding == 'bech32' and witness_version != 0:
            raise ValueError(f"Bech32 encoding only valid for witness version 0")
        if encoding == 'bech32m' and witness_version == 0:
            raise ValueError(f"Bech32m encoding not valid for witness version 0")

        # Create witness program scriptPubKey: OP_<version> <program>
        if witness_version == 0:
            # SegWit v0: OP_0 <20 or 32 bytes>
            script = CScript([0, witness_program])
        else:
            # SegWit v1+ (including Taproot): OP_1 <32 bytes>
            script = CScript([OP_1 if witness_version == 1 else witness_version, witness_program])

        return bytes(script)
    else:
        # Try as legacy address (P2PKH or P2SH)
        try:
            addr = CBitcoinAddress(address)
            return bytes(addr.to_scriptPubKey())
        except Exception as e:
            raise ValueError(f"Invalid Bitcoin address: {address}") from e


class UTXO:
    """Class to represent a UTXO"""
    def __init__(self, txid: str, vout: int, value: int, script_pub_key: str):
        self.txid = txid
        self.vout = vout
        self.value = value  # in satoshis
        self.script_pub_key = script_pub_key

    def __repr__(self):
        return f"UTXO(txid={self.txid[:8]}..., vout={self.vout}, value={self.value})"


def fetch_utxos_blockstream(address: str, network: str = "testnet") -> List[UTXO]:
    """
    Fetch UTXOs for a given address using Blockstream's public API.

    Args:
        address: Bitcoin address to query
        network: 'mainnet' or 'testnet'

    Returns:
        List of UTXO objects
    """
    # Blockstream API endpoints
    base_urls = {
        "mainnet": "https://blockstream.info/api",
        "testnet": "https://blockstream.info/testnet/api"
    }

    if network not in base_urls:
        raise ValueError(f"Network must be 'mainnet' or 'testnet', got: {network}")

    base_url = base_urls[network]

    print(f"Fetching UTXOs for address: {address} on {network}...")

    try:
        # Get UTXOs for the address
        response = requests.get(f"{base_url}/address/{address}/utxo", timeout=10)
        response.raise_for_status()

        utxos_data = response.json()

        if not utxos_data:
            print(f"No UTXOs found for address {address}")
            return []

        utxos = []
        for utxo_data in utxos_data:
            # Get the transaction to fetch scriptPubKey
            tx_response = requests.get(f"{base_url}/tx/{utxo_data['txid']}", timeout=10)
            tx_response.raise_for_status()
            tx_data = tx_response.json()

            # Get the specific output
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

    Args:
        utxos: List of available UTXOs
        target_amount: Amount to send in satoshis
        fee: Transaction fee in satoshis

    Returns:
        List of selected UTXOs or None if insufficient funds
    """
    # Sort by value (smallest first)
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

    Args:
        tx: Unsigned transaction
        utxos: List of UTXOs being spent

    Returns:
        PSBT as hex string
    """
    psbt = BytesIO()

    # Magic bytes and separator
    psbt.write(b'\x70\x73\x62\x74\xff')

    # Global types
    # Unsigned transaction
    psbt.write(b'\x01\x00')  # Key: global unsigned tx

    # Serialize the unsigned transaction
    tx_bytes = tx.serialize()
    psbt.write(compact_size(len(tx_bytes)))
    psbt.write(tx_bytes)

    # End global section
    psbt.write(b'\x00')

    # Input sections (one per input)
    for utxo in utxos:
        # For each input, we need to provide witness_utxo or non_witness_utxo
        # For SegWit/Taproot addresses, we use witness_utxo

        # PSBT_IN_WITNESS_UTXO (0x01)
        psbt.write(b'\x01\x01')  # Key type and length

        # Create the witness UTXO (CTxOut)
        script_bytes = bytes.fromhex(utxo.script_pub_key)
        witness_utxo = CTxOut(utxo.value, script_bytes)
        utxo_bytes = witness_utxo.serialize()

        psbt.write(compact_size(len(utxo_bytes)))
        psbt.write(utxo_bytes)

        # For Taproot inputs, add the internal key (BIP 371)
        if is_taproot_output(script_bytes):
            # PSBT_IN_TAP_INTERNAL_KEY (0x17)
            # The internal key is the 32-byte x-only pubkey from the scriptPubKey
            internal_key = script_bytes[2:]  # Skip OP_1 and length byte

            psbt.write(b'\x01\x17')  # Key: tap internal key type
            psbt.write(compact_size(len(internal_key)))
            psbt.write(internal_key)

        # End this input section
        psbt.write(b'\x00')

    # Output sections (one per output)
    for _ in tx.vout:
        # No additional data needed for outputs in this simple case
        psbt.write(b'\x00')

    return psbt.getvalue().hex()


def compact_size(n: int) -> bytes:
    """
    Encode a number as Bitcoin compact size.

    Args:
        n: Number to encode

    Returns:
        Compact size encoded bytes
    """
    if n < 0xfd:
        return bytes([n])
    elif n <= 0xffff:
        return b'\xfd' + struct.pack('<H', n)
    elif n <= 0xffffffff:
        return b'\xfe' + struct.pack('<I', n)
    else:
        return b'\xff' + struct.pack('<Q', n)


def create_psbt_from_utxos(
    sender_address: str,
    recipient_address: str,
    send_amount: int,
    fee: int,
    network: str = "testnet"
) -> Optional[tuple[str, CTransaction]]:
    """
    Create a PSBT using real UTXOs fetched from the blockchain.

    Args:
        sender_address: Address to spend from
        recipient_address: Address to send to
        send_amount: Amount to send in satoshis
        fee: Transaction fee in satoshis
        network: 'mainnet' or 'testnet'

    Returns:
        Tuple of (PSBT hex string, unsigned transaction) or None if failed
    """
    # Set network parameters
    SelectParams('testnet' if network == 'testnet' else 'mainnet')

    print("=== Bitcoin PSBT Construction with Real UTXOs ===\n")

    # Fetch UTXOs
    utxos = fetch_utxos_blockstream(sender_address, network)

    if not utxos:
        print("No UTXOs available. Cannot create transaction.")
        return None

    # Select UTXOs for the transaction
    selected_utxos = select_utxos_for_amount(utxos, send_amount, fee)

    if not selected_utxos:
        return None

    # Calculate input total and change
    input_total = sum(utxo.value for utxo in selected_utxos)
    change_amount = input_total - send_amount - fee

    print(f"\n=== Transaction Summary ===")
    print(f"Sender: {sender_address}")
    print(f"Recipient: {recipient_address}")
    print(f"Amount to send: {send_amount} satoshis ({send_amount / 100000000:.8f} BTC)")
    print(f"Fee: {fee} satoshis ({fee / 100000000:.8f} BTC)")
    print(f"Change: {change_amount} satoshis ({change_amount / 100000000:.8f} BTC)")
    print(f"Total input: {input_total} satoshis")
    print(f"Using {len(selected_utxos)} UTXO(s)\n")

    # ============================================
    # Create the unsigned transaction
    # ============================================

    # Create transaction inputs
    txins = []
    for utxo in selected_utxos:
        txin = CTxIn(COutPoint(lx(utxo.txid), utxo.vout))
        txins.append(txin)

    # Create transaction outputs
    txouts = []

    # Output 1: Payment to recipient
    recipient_scriptPubKey = address_to_scriptpubkey(recipient_address)
    txout_recipient = CTxOut(send_amount, recipient_scriptPubKey)
    txouts.append(txout_recipient)

    # Output 2: Change back to sender (if any)
    if change_amount > 0:
        sender_scriptPubKey = address_to_scriptpubkey(sender_address)
        txout_change = CTxOut(change_amount, sender_scriptPubKey)
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


def main():
    sender_address = os.getenv('BTC_SENDER_ADDRESS_STG')
    recipient_address = os.getenv('BTC_RECIPIENT_ADDRESS_STG')
    send_amount = os.getenv('BTC_SEND_AMOUNT')
    fee = os.getenv('BTC_FEE', '200')
    network = os.getenv('BTC_NETWORK', 'testnet')

    if not sender_address:
        print("Error: BTC_SENDER_ADDRESS environment variable not set")
        print("\nExample usage:")
        print("export BTC_SENDER_ADDRESS='tb1q...'")
        print("export BTC_RECIPIENT_ADDRESS='tb1q...'")
        print("export BTC_SEND_AMOUNT='50000'  # in satoshis")
        print("export BTC_FEE='1000'  # optional, in satoshis")
        print("export BTC_NETWORK='testnet'  # or 'mainnet'")
        return
    if not recipient_address:
        print("Error: BTC_RECIPIENT_ADDRESS environment variable not set")
        return
    if not send_amount:
        print("Error: BTC_SEND_AMOUNT environment variable not set")
        return
    # Validate that sender address is not a legacy address
    # Fordefi cannot sign PSBTs with legacy sender addresses
    if is_legacy_address(sender_address):
        print("Error: BTC_SENDER_ADDRESS cannot be a legacy address")
        print("Legacy addresses (starting with '1', '3', 'm', 'n', or '2') are not supported by Fordefi.")
        print("Please use a SegWit (bc1q/tb1q) or Taproot (bc1p/tb1p) address instead.")
        print(f"Provided address: {sender_address}")
        return

    try:
        send_amount = int(send_amount)
        fee = int(fee)
    except ValueError:
        print("Error: BTC_SEND_AMOUNT and BTC_FEE must be integers (satoshis)")
        return
    if send_amount <= 0:
        print("Error: BTC_SEND_AMOUNT must be positive")
        return
    if fee < 0:
        print("Error: BTC_FEE cannot be negative")
        return

    result = create_psbt_from_utxos(
        sender_address=sender_address,
        recipient_address=recipient_address,
        send_amount=send_amount,
        fee=fee,
        network=network
    )

    if result:
        psbt_hex, _ = result
        print("\n✓ PSBT construction successful!")

        # OPTIONAL - Save PSBT to file
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
