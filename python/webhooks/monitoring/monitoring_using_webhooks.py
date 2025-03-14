import http  
import http.server  
import json  
import logging

PORT = 8080

logger = logging.getLogger(__name__)

class WebhooksListener(http.server.BaseHTTPRequestHandler):  
    def do_POST(self):  
        logger.info("Received POST request")  
        content_length = int(self.headers["Content-Length"])  
        body = self.rfile.read(content_length)  
        event = json.loads(body)  
        event_type = event["event_type"]  
        logger.info(f"Received a new event of type: {event_type=}")  
        if event_type == "transaction_state_update":  
            self._on_transaction_update(event["event"])  
        self.send_response(http.HTTPStatus.OK, "OK")  
        self.end_headers()

    def do_GET(self):
        logger.info("Received GET request")
        self.send_response(http.HTTPStatus.OK)
        self.end_headers()
        self.wfile.write(b"Got GET request")

    def _on_transaction_update(self, transaction_event) -> None:
        transaction_id = transaction_event["transaction_id"]
        state = transaction_event["state"]
        logger.info(f"Received a transaction update: {transaction_id=} changed state to {state=}")

    def log_message(format, *args):
        pass

def setup_logging() -> None:  
    handler = logging.StreamHandler()  
    handler.setFormatter(logging.Formatter("%(asctime)s:%(name)s:%(levelname)s:%(message)s"))  
    logger.setLevel(logging.INFO)  
    logger.addHandler(handler)

def main() -> None:  
    setup_logging()

    logger.info(f"Listening on port {PORT}...")
    http.server.HTTPServer(("0.0.0.0", PORT), WebhooksListener).serve_forever()


if __name__ == "__main__":  
    main()