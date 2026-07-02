# Fordefi Webhook Handler

This webhook handler listens for events from your Fordefi organization and processes transaction data.

It exposes a single POST endpoint which:

1. Verifies the signature in the `X-Signature` header
2. Extracts the transaction ID from the event
3. Fetches detailed transaction data from the Fordefi API
4. Returns the transaction data for further processing

## Prerequisites

- Python 3.8+
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
uvicorn fordefi_webhooks:app --host 0.0.0.0 --port 8080 --reload
```

This will start a FastAPI server on port 8080 that listens for webhook events from Fordefi.

You can now use tools like ngrok to expose your local webhook server to the internet for testing:

```bash
ngrok http 8080
```

Then configure your Fordefi webhook to use the ngrok URL.

### Configuring Fordefi Webhooks

1. Log in to your Fordefi console
2. Navigate to Settings > Webhooks
3. Add a new webhook with your ngrok server's URL (e.g., `https://your-server.com/`)
4. Save the webhook configuration
5. Test the webhook

## Audit-Log Security Monitor (`audit_logs_webhooks.py`)

A second server that monitors your organization's [audit log](https://docs.fordefi.com/api/openapi/audit-log) via webhooks. It receives audit-log events, verifies their signature, and flags security-sensitive categories (policy changes, user management, authentication, backups, etc.) as alerts. It also exposes admin routes for browsing the audit log and re-delivering records through the webhook pipeline.

Routes:

- `POST /` — webhook receiver; verifies the `X-Signature` header, then classifies the audit record by `category`. Sensitive events are printed as 🚨 alerts and appended to `live-events/audit_alerts.json`; everything else goes to `live-events/audit_events.json`. Edit `SENSITIVE_CATEGORIES` in the file to tune what counts as an alert.
- `GET /audit-logs` — lists audit-log records via [`GET /api/v1/audit-log`](https://docs.fordefi.com/api/openapi/audit-log/list_audit_log_records_api_v1_audit_log_get). Supports `page`, `size`, `category` (repeatable), `created_after`, and `created_before` query parameters.
- `POST /replay/{record_id}` — re-delivers a specific audit-log record to your configured webhooks via [`POST /api/v1/webhooks/trigger/audit-log/{id}`](https://docs.fordefi.com/api/openapi/webhooks/trigger_audit_log_webhook_api_v1_webhooks_trigger_audit_log__id__post). Useful for testing your pipeline end-to-end or re-processing an event your server missed.
- `GET /health` — liveness check.

Start it with:
```bash
uvicorn audit_logs_webhooks:app --host 0.0.0.0 --port 8080 --reload
```

When configuring the webhook in the Fordefi console (Settings > Webhooks), select **Audit logs** as the trigger type and point it at your server's public URL (e.g., via ngrok). To test the full loop, fetch a record ID from `GET /audit-logs`, then `POST /replay/{record_id}` — the replayed event will arrive back at `POST /` and be classified.

## Webhook delivery timeout (how fast your server must respond)

**Fordefi gives your endpoint ~5 seconds to return a `2xx` response.** If your server
hasn't responded within that window, Fordefi closes the connection and treats the
delivery as **failed / not handled**.

Practical implication: do **not** do heavy work inline in the handler. Verify the
signature, persist/enqueue the event, and return `200` immediately. Run any slow
processing (API calls, DB writes, fetching full transaction details) asynchronously
*after* responding.

## Learn More About the Fordefi API:

- Using Webhooks: [https://docs.fordefi.com/developers/webhooks#validate-a-webhook](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)
- Managing transactions via API: [https://docs.fordefi.com/api/openapi/transactions](https://docs.fordefi.com/api/openapi/transactions)