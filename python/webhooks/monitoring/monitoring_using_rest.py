import os
import argparse  
import logging  
import time  
import uuid
import requests

PORT = 8080

logger = logging.getLogger(__name__)

def setup_logging() -> None:  
    handler = logging.StreamHandler()  
    handler.setFormatter(logging.Formatter("%(asctime)s:%(name)s:%(levelname)s:%(message)s"))  
    logger.setLevel(logging.INFO)  
    logger.addHandler(handler)

def monitor_transaction(  
    access_token: str,  
    transaction_id: uuid.UUID,  
    polling_interval: int,  
) -> None:  
    setup_logging()

    logger.info(f"Monitoring transaction: {transaction_id=}")

    current_state = None

    while True:
        transaction = requests.get(
            url=f"https://api.fordefi.com/api/v1/transactions/{transaction_id}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        ).json()
        new_state = transaction["state"]
        if new_state != current_state:
            logger.info(f"Transaction {transaction_id=} changed state from {current_state=} to {new_state=}")
            current_state = new_state
            if new_state == "completed":
                break
        else:
            logger.info(f"Transaction {transaction_id=} is still in state {current_state=}")
        logger.info(f"Sleeping for {polling_interval=} seconds")
        time.sleep(polling_interval)


def parse_args() -> argparse.Namespace:  
    parser = argparse.ArgumentParser()  
    parser.add_argument("--tx-id", type=uuid.UUID, required=True, help="Transaction ID to monitor")  
    parser.add_argument("--access-token", type=str, help="Access token for Fordefi API (can also use FORDEFI_API_USER_TOKEN env var)")  
    parser.add_argument("--polling-interval", type=int, default=2, help="Polling interval in seconds")  
    return parser.parse_args()


if __name__ == "__main__":  

    args = parse_args()  
    # Use access token from args if provided, otherwise from .env variable
    access_token = args.access_token or os.getenv("FORDEFI_API_USER_TOKEN")
    if not access_token:
        raise ValueError("Access token must be provided either via --access-token or FORDEFI_API_USER_TOKEN environment variable")
    
    monitor_transaction(  
        access_token=access_token,  
        transaction_id=args.tx_id,  
        polling_interval=args.polling_interval,  
    )