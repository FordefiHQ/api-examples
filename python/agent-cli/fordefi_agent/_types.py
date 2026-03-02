class FordefiError(Exception):
    """Error from the Fordefi API or client."""

    def __init__(self, message: str, status_code: int | None = None,
                 request_id: str | None = None, details: dict | None = None):
        self.message = message
        self.status_code = status_code
        self.request_id = request_id
        self.details = details or {}
        super().__init__(self._format())

    def _format(self) -> str:
        parts = [self.message]
        if self.status_code:
            parts.append(f"HTTP {self.status_code}")
        if self.request_id:
            parts.append(f"Request-ID: {self.request_id}")
        if self.details:
            parts.append(f"Details: {self.details}")
        return " | ".join(parts)


class FordefiTimeoutError(FordefiError):
    """Raised when wait_for_transaction exceeds the timeout."""

    def __init__(self, transaction_id: str, timeout: int):
        super().__init__(
            f"Transaction {transaction_id} did not reach terminal state within {timeout}s"
        )
        self.transaction_id = transaction_id
        self.timeout = timeout
