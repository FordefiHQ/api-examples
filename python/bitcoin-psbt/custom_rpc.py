import asyncio
import base64
import datetime
import requests
from pathlib import Path
from sign_payload import sign_wih_api_user_private_key


async def poll_for_signed_tx(
    tx_id: str,
    api_token: str,
    private_key_file: Path,
    max_attempts: int = 30,
    poll_interval: float = 2.0
) -> str:
    poll_path = f"/api/v1/transactions/{tx_id}"

    for attempt in range(max_attempts):
        print(f"Polling for signed transaction (attempt {attempt + 1}/{max_attempts})...")

        timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()))
        payload = f"{poll_path}|{timestamp}|"
        signature = await sign_wih_api_user_private_key(payload, private_key_file)

        resp = requests.get(
            f"https://api.fordefi.com{poll_path}",
            headers={
                "Authorization": f"Bearer {api_token}",
                "x-signature": base64.b64encode(signature),
                "x-timestamp": timestamp,
            },
        )
        resp.raise_for_status()
        tx_data = resp.json()

        state = tx_data.get("state")
        print(f"  Transaction state: {state}")

        if state == "signed":
            utxo_details = tx_data.get("utxo_transaction_type_details", {})
            raw_signed_tx = utxo_details.get("signed_psbt_raw_data")

            if raw_signed_tx:
                print("Payload signed with API User private key! ✅")
                return raw_signed_tx
            else:
                print(f"Available top-level keys: {list(tx_data.keys())}")
                if utxo_details:
                    print(f"Available utxo_transaction_type_details keys: {list(utxo_details.keys())}")
                raise RuntimeError("Transaction signed but signed_psbt_raw_data not found in response.")

        if state in ("failed", "aborted", "rejected"):
            raise RuntimeError(f"Transaction failed with state: {state}")

        await asyncio.sleep(poll_interval)

    raise RuntimeError(f"Timeout: Transaction not signed after {max_attempts} attempts")


def broadcast_via_custom_rpc(raw_tx_hex: str, rpc_url: str, rpc_format: str = "rest") -> str:
    if raw_tx_hex.startswith("0x"):
        raw_tx_hex = raw_tx_hex[2:]

    print(f"Broadcasting transaction via custom RPC: {rpc_url} (format: {rpc_format})")

    if rpc_format == "jsonrpc":
        # Bitcoin Core JSON-RPC format
        payload = {
            "jsonrpc": "1.0",
            "id": "broadcast",
            "method": "sendrawtransaction",
            "params": [raw_tx_hex]
        }
        resp = requests.post(rpc_url, json=payload, timeout=30)
        resp.raise_for_status()

        result = resp.json()
        if "error" in result and result["error"] is not None:
            raise RuntimeError(f"RPC error: {result['error']}")

        txid = result.get("result")

    elif rpc_format == "blockcypher":
        # BlockCypher format: POST JSON {"tx": "hex"}
        resp = requests.post(
            rpc_url,
            json={"tx": raw_tx_hex},
            timeout=30
        )
        resp.raise_for_status()
        result = resp.json()
        txid = result.get("tx", {}).get("hash")

    else:
        # REST format (Blockstream/Mempool): POST raw hex as body
        resp = requests.post(
            rpc_url,
            data=raw_tx_hex,
            headers={"Content-Type": "text/plain"},
            timeout=30
        )
        resp.raise_for_status()
        txid = resp.text.strip()

    print(f"Transaction broadcast successfully! TXID: {txid}")
    return txid
