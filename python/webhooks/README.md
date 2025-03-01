# Fordefi Webhook Handler

This webhook handler listens for events from your Fordefi organization and processes transaction data.

It exposes a single POST endpoint which:

1. Verifies the signature in the `X-Signature` header
2. Extracts the transaction ID from the event
3. Fetches detailed transaction data from the Fordefi API
4. Returns the transaction data for further processing

## Prerequisites

- Python 3.x
- Fordefi API User Token and Fordefi API Signer set up: [https://docs.fordefi.com/developers/program-overview](https://docs.fordefi.com/developers/program-overview)
- Setting up webhook from Fordefi console: [https://docs.fordefi.com/developers/webhooks](https://docs.fordefi.com/developers/webhooks)

## Setup

1. Install `uv` package manager:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Set up the project and install dependencies:
   ```bash
   git clone <repository-url>
   cd <repository-name>
   uv sync

2. Configure environment variables:
   Create a `.env` file in the same directory with:
   ```plaintext
   FORDEFI_API_USER_TOKEN="your_api_user_token"
   ```

3. Obtain the Fordefi public key [here](https://docs.fordefi.com/developers/webhooks#validate-a-webhook) and save it as `public_key.pem` in the same directory as the app.py file.

4. Place your API Signer's `.pem` private key file in a `/secret` directory in the root folder.

5. Start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.


## Testing

### Running the Webhook Server

Start the webhook server with:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

This will start a FastAPI server on port 8000 that listens for webhook events from Fordefi.

You can now use tools like ngrok to expose your local webhook server to the internet for testing:

```bash
ngrok http 8000
```

Then configure your Fordefi webhook to use the ngrok URL.

### Configuring Fordefi Webhooks

1. Log in to your Fordefi console
2. Navigate to Settings > Webhooks
3. Add a new webhook with your server's URL (e.g., `https://your-server.com/fordefi_webhook`)
4. Save the webhook configuration
5. Test the webhook

## Learn More About the Fordefi API:

- Using Webhooks: [https://docs.fordefi.com/developers/webhooks#validate-a-webhook](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)
- Managing transactions via API: [https://docs.fordefi.com/api/openapi/transactions](https://docs.fordefi.com/api/openapi/transactions)