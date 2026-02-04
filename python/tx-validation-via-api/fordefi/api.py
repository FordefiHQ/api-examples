import requests
from typing import Dict, Optional
from http import HTTPStatus
from fastapi import HTTPException


class FordefiAPI:
    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url
        self.access_token = access_token

    def _authorization_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}

    def _extract_error_details(self, error: requests.exceptions.RequestException) -> str:
        if not hasattr(error, 'response') or error.response is None:
            return ""

        details = [f"Status: {error.response.status_code}"]

        request_id = error.response.headers.get('x-request-id')
        if request_id:
            details.append(f"Request ID: {request_id}")

        try:
            if error.response.text:
                details.append(f"Response: {error.response.text}")
        except:
            pass

        return ", ".join(details)

    def fetch_transaction(self, transaction_id: str) -> Dict:
        url = f"{self.base_url}/transactions/{transaction_id}"

        try:
            response = requests.get(url, headers=self._authorization_headers())
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as error:
            print(f"Failed to fetch transaction {transaction_id}: {error}")
            return {}

    def approve_transaction(self, transaction_id: str) -> None:
        url = f"{self.base_url}/transactions/{transaction_id}/approve"

        try:
            response = requests.post(url, headers=self._authorization_headers())
            response.raise_for_status()
            print(f"Transaction {transaction_id} approved")
        except requests.exceptions.RequestException as error:
            error_details = self._extract_error_details(error)
            print(f"Failed to approve transaction: {error} ({error_details})")

            if self._is_bad_request_error(error):
                print("Transaction may already be approved or in invalid state")
                return

            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail=f"Failed to approve transaction. {error_details}"
            )

    def abort_transaction(self, transaction_id: str, reason: str) -> None:
        current_state = self.fetch_transaction(transaction_id).get("state")
        if current_state == "aborted":
            print(f"Transaction {transaction_id} already aborted")
            return

        url = f"{self.base_url}/transactions/{transaction_id}/abort"

        try:
            response = requests.post(url, headers=self._authorization_headers())
            response.raise_for_status()
            print(f"Transaction {transaction_id} aborted: {reason}")
        except requests.exceptions.RequestException as error:
            error_details = self._extract_error_details(error)
            print(f"Failed to abort transaction: {error} ({error_details})")

            if self._is_bad_request_error(error):
                print("Transaction may already be aborted or in invalid state")
                return

            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail=f"Failed to abort transaction: {reason}. {error_details}"
            )

    def _is_bad_request_error(self, error: requests.exceptions.RequestException) -> bool:
        return (
            hasattr(error, 'response')
            and error.response is not None
            and error.response.status_code == 400
        )
