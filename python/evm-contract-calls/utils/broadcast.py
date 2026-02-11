import json
import time
import base64
import requests

async def broadcast_tx(
    path: str, 
    access_token: str, 
    signature: bytes, 
    timestamp: str, 
    request_body: str
) -> requests.Response:

    try:
        resp_tx = requests.post(
            f"https://api.fordefi.com{path}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "x-signature": base64.b64encode(signature),
                "x-timestamp": timestamp.encode(),
            },
            data=request_body,
        )
        resp_tx.raise_for_status()
        return resp_tx

    except requests.exceptions.HTTPError as e:
        error_message = f"HTTP error occurred: {str(e)}"
        if resp_tx.text:
            try:
                error_detail = resp_tx.json()
                error_message += f"\nError details: {error_detail}"
            except json.JSONDecodeError:
                error_message += f"\nRaw response: {resp_tx.text}"
        raise RuntimeError(error_message)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error occurred: {str(e)}")


async def get_tx(
    tx_id: str,
    access_token: str,
    signature: bytes,
    timestamp: str,
) -> requests.Response:

    try:
        resp_tx = requests.get(
            f"https://api.fordefi.com/api/v1/transactions/{tx_id}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "x-signature": base64.b64encode(signature),
                "x-timestamp": timestamp.encode(),
            },
        )
        resp_tx.raise_for_status()
        return resp_tx

    except requests.exceptions.HTTPError as e:
        error_message = f"HTTP error occurred: {str(e)}"
        if resp_tx.text:
            try:
                error_detail = resp_tx.json()
                error_message += f"\nError details: {error_detail}"
            except json.JSONDecodeError:
                error_message += f"\nRaw response: {resp_tx.text}"
        raise RuntimeError(error_message)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error occurred: {str(e)}")

async def poll_until_waiting_for_signing(
    api_access_token: str,
    transaction_id: str,
    max_attempts: int = 30,
    poll_interval_seconds: int = 2,
) -> dict:
    for attempt in range(max_attempts):
        response = requests.get(
            f"https://api.fordefi.com/api/v1/transactions/{transaction_id}",
            headers={"Authorization": f"Bearer {api_access_token}"},
        )
        response.raise_for_status()
        transaction = response.json()
        state = transaction["state"]
        print(f"  Attempt {attempt + 1}: state = {state}")

        if state == "waiting_for_signing_trigger":
            return transaction
        if state in ("completed", "failed", "aborted", "mined"):
            raise RuntimeError(f"Transaction reached terminal state '{state}' before signing trigger")

        time.sleep(poll_interval_seconds)

    raise TimeoutError("Transaction did not reach 'waiting_for_signing_trigger' in time")