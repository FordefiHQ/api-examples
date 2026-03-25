import requests
import base64
import json

def make_api_request(path, access_token, signature, timestamp, request_body, method):
    try:
        print("Pushing payload to Fordefi 🏰")
        print("Waiting for approvals and MPC signatures ⏳")
        resp_tx = requests.request(
            method=method,
            url=f"https://api.fordefi.com{path}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "x-signature": base64.b64encode(signature),
                "x-timestamp": timestamp.encode(),
            },
            data=request_body,
        )
        resp_tx.raise_for_status()

        return resp_tx.json()

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
