import requests
import base64
import json

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