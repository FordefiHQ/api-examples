import logging
import requests
from typing import Dict

REQUEST_TIMEOUT = (5, 15)  # (connect, read) seconds

logger = logging.getLogger("cosigner.api")


class FordefiAPIError(Exception):
    pass


class FordefiAPI:
    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url
        self.access_token = access_token

    def _authorization_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}

    def _extract_error_details(self, error: requests.exceptions.RequestException) -> str:
        response = getattr(error, "response", None)
        if response is None:
            return ""

        details = [f"Status: {response.status_code}"]

        request_id = response.headers.get("x-request-id")
        if request_id:
            details.append(f"Request ID: {request_id}")

        if response.text:
            details.append(f"Response: {response.text}")

        return ", ".join(details)

    def fetch_transaction(self, transaction_id: str) -> Dict:
        url = f"{self.base_url}/transactions/{transaction_id}"

        try:
            response = requests.get(url, headers=self._authorization_headers(), timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as error:
            raise FordefiAPIError(
                f"Failed to fetch transaction {transaction_id}: {error} ({self._extract_error_details(error)})"
            ) from error

    def approve_transaction(self, transaction_id: str) -> None:
        self._decide_transaction(transaction_id, "approve")

    def abort_transaction(self, transaction_id: str, reason: str) -> None:
        # The abort endpoint takes no request body, so the reason is only logged here.
        logger.info("Aborting transaction %s: %s", transaction_id, reason)
        self._decide_transaction(transaction_id, "abort")

    def _decide_transaction(self, transaction_id: str, action: str) -> None:
        url = f"{self.base_url}/transactions/{transaction_id}/{action}"

        try:
            response = requests.post(url, headers=self._authorization_headers(), timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            logger.info("Transaction %s %s succeeded", transaction_id, action)
        except requests.exceptions.RequestException as error:
            error_details = self._extract_error_details(error)
            # 400 means the transaction already left waiting_for_approval — a benign
            # race with another approver or a webhook retry, so treat it as a no-op.
            if self._is_bad_request_error(error):
                logger.info(
                    "Transaction %s %s skipped, state already changed (%s)",
                    transaction_id, action, error_details,
                )
                return
            raise FordefiAPIError(
                f"Failed to {action} transaction {transaction_id}: {error} ({error_details})"
            ) from error

    def _is_bad_request_error(self, error: requests.exceptions.RequestException) -> bool:
        response = getattr(error, "response", None)
        return response is not None and response.status_code == 400
