from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import eth_abi


@dataclass(frozen=True)
class FunctionAbi:
    name: str
    arg_names: Tuple[str, ...]
    arg_types: Tuple[str, ...]  # eth_abi type strings; structs written as "(address,uint256,...)"


# Function selectors the CoSigner knows how to decode. To validate a new contract call,
# add its selector and signature here, then read the decoded arguments from your rule.
ABI_REGISTRY: Dict[str, FunctionAbi] = {
    # 1inch AggregationRouterV6.swap
    # swap(address executor,
    #      (address srcToken, address dstToken, address srcReceiver, address dstReceiver,
    #       uint256 amount, uint256 minReturnAmount, uint256 flags) desc,
    #      bytes data)
    # V4/V5 routers use selector 0x7c025200 with an extra `bytes permit` member in the struct.
    "0x07ed2379": FunctionAbi(
        name="swap",
        arg_names=("executor", "desc", "data"),
        arg_types=(
            "address",
            "(address,address,address,address,uint256,uint256,uint256)",
            "bytes",
        ),
    ),
}

ONEINCH_SWAP_V6_SELECTOR = "0x07ed2379"


@dataclass
class DecodedCall:
    selector: str
    function_name: str
    args: Dict[str, Any]  # addresses come back as lowercase "0x…" strings, structs as tuples


def decode_calldata(hex_data: str) -> Tuple[Optional[DecodedCall], Optional[str]]:
    """Decode calldata against the ABI registry.

    Returns (decoded, None) on success, (None, None) for empty calldata or an
    unregistered selector, and (None, error) when the selector is registered but
    the calldata does not decode — rules must treat that as a validation failure.
    """
    if not hex_data or len(hex_data) < 10:
        return None, None
    selector = hex_data[:10].lower()
    abi = ABI_REGISTRY.get(selector)
    if abi is None:
        return None, None
    try:
        values = eth_abi.decode(list(abi.arg_types), bytes.fromhex(hex_data[10:]))
    except Exception as error:
        return None, f"failed to decode {abi.name} ({selector}): {error}"
    return DecodedCall(selector, abi.name, dict(zip(abi.arg_names, values))), None
