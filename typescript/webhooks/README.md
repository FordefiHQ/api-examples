# Fordefi Webhook Handlers (TypeScript)

Three TypeScript Express.js webhook servers:

## Implementation Options

### 1. Fordefi Handler (`webhooks_fordefi.ts`)
- Receives and logs Fordefi transaction webhook events
- Verifies `X-Signature` header using ECDSA P-256
- Read-only — no API calls, only requires Fordefi public key

### 2. Audit-Log Security Monitor (`webhooks_audit_logs.ts`)
- Receives Fordefi **audit-log** webhook events and verifies `X-Signature` using ECDSA P-256
- Flags security-sensitive categories (policy changes, user management, authentication, backups, etc.) as 🚨 alerts, logged to `live_logs/audit_alerts/`; other events go to `live_logs/audit/`
- Admin routes for browsing the [audit log](https://docs.fordefi.com/api/openapi/audit-log/list_audit_log_records_api_v1_audit_log_get) and [re-delivering a record](https://docs.fordefi.com/api/openapi/webhooks/trigger_audit_log_webhook_api_v1_webhooks_trigger_audit_log__id__post) through the webhook pipeline — useful for end-to-end testing or re-processing missed events
- Edit `SENSITIVE_CATEGORIES` in the file to tune what counts as an alert

### 3. Hypernative Handler (`webhooks_hypernative.ts`)
- Dedicated to Hypernative events — handles two types:
  - **Webhook Actions** (`/hypernative`) — Hypernative sends a pre-created Fordefi transaction ID in the `fordefi-transaction-id` header. The server verifies the signature and triggers signing via the Fordefi API. Uses `keys/hypernative_public_key.pem`.
  - **Risk Insights** (`/hypernative/risk-insights`) — Hypernative sends a risk insight event with the signature embedded in the body. The server verifies it and responds by executing a contract call through Fordefi's web3 provider (configured in `fordefi-response/`). Uses `keys/hypernative_public_key_2.pem`.
- Auto-routing on `POST /` detects the event type by checking for `fordefi-transaction-id` header

## Prerequisites

### For Both:
- **Node.js 18+**
- **npm** or **yarn**

### For `webhooks_fordefi.ts`:
- **Fordefi Public Key** — [Download from webhook docs](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)

### For `webhooks_audit_logs.ts`:
- **Fordefi Public Key** — [Download from webhook docs](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)
- **Fordefi API User Token** with **ADMIN or VIEWER role** (required by the audit-log API) — [Get your token here](https://docs.fordefi.com/developers/getting-started/create-an-api-user)

### For `webhooks_hypernative.ts`:
- **Fordefi API User Token** — [Get your token here](https://docs.fordefi.com/developers/getting-started/create-an-api-user)
- **Fordefi API Signer** — [Set up here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
- **Hypernative Account** — [Sign up here](https://app.hypernative.xyz/)
- **Hypernative Public Keys** — Contact Hypernative support for both keys

## Installation

```bash
cd api-examples/typescript/webhooks
npm install
```

## Configuration

### `webhooks_fordefi.ts`

Save the Fordefi public key to `keys/fordefi_public_key.pem` ([download here](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)), or set it via the `FORDEFI_PUBLIC_KEY` env var.

### `webhooks_audit_logs.ts`

1. Save the Fordefi public key to `keys/fordefi_public_key.pem` (or set the `FORDEFI_PUBLIC_KEY` env var)
2. Create a `.env` file:
   ```env
   FORDEFI_API_USER_TOKEN=your_fordefi_api_token_here
   ```
3. In the Fordefi console (Settings → Webhooks), configure a webhook with trigger type **Audit logs** pointing at your server's public URL

### `webhooks_hypernative.ts`

1. Create a `.env` file:
   ```env
   FORDEFI_API_USER_TOKEN=your_fordefi_api_token_here
   ```

2. Place Hypernative public keys in `keys/`:
   - `keys/hypernative_public_key.pem` — for webhook actions (or set `HYPERNATIVE_PUBLIC_KEY` env var)
   - `keys/hypernative_public_key_2.pem` — for risk insights (or set `HYPERNATIVE_PUBLIC_KEY_2` env var)

3. Configure the Fordefi web3 provider in `fordefi-response/config.ts`:
   - Set the vault address and chain ID (the target contract is extracted dynamically from each Hypernative alert)
   - Place your Fordefi API signer private key at `fordefi-response/fordefi_secret/private.pem`

## Usage

```bash
# Fordefi-only webhooks
npm run fordefi_server

# Audit-log security monitor
npm run audit_logs_server

# Hypernative webhooks
npm run hypernative_server
```

## API Endpoints

### `webhooks_fordefi.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/` | Fordefi webhook events |

### `webhooks_audit_logs.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/` | Audit-log webhook events — verifies signature, classifies by category |
| `GET` | `/audit-logs` | Lists audit-log records (params: `page`, `size`, `category` (repeatable), `created_after`, `created_before`) |
| `POST` | `/replay/:recordId` | Re-delivers an audit-log record to configured webhooks |

To test the full loop: fetch a record `id` from `GET /audit-logs`, then `POST /replay/:recordId` — the replayed event arrives back at `POST /` and gets classified.

### `webhooks_hypernative.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/` | Auto-routes between webhook actions and risk insights |
| `POST` | `/hypernative` | Webhook actions — verifies signature, triggers Fordefi transaction signing |
| `POST` | `/hypernative/risk-insights` | Risk insights — verifies signature, executes contract call via Fordefi |

## Fordefi webhook delivery timeout (how fast your server must respond)

**Fordefi gives your endpoint ~5 seconds to return a `2xx` response.** If your server
hasn't responded within that window, Fordefi closes the connection and treats the
delivery as **failed / not handled**.

Practical implication: do **not** do heavy work inline in the handler. Verify the
signature, persist/enqueue the event, and return `200` immediately. Run any slow
processing (API calls, DB writes, fetching full transaction details) asynchronously
*after* responding.

## Hypernative Event Types

### Webhook Actions (Fordefi-triggered transactions)

Hypernative sends these when a policy triggers a pre-created Fordefi transaction. The server verifies the signature and calls Fordefi's `/trigger-signing` API to approve it.

**Headers:**
```http
Content-Type: application/json
fordefi-transaction-id: d8f907cd-438a-45b4-a22c-0851338a7678
```

**Payload:**
```json
{
  "id": "unique-webhook-message-id",
  "data": "{...JSON string containing riskInsight data...}",
  "digitalSignature": "MEYCIQCLpMfKwuubxs73AZ4l58+..."
}
```

**Response:**
```json
{
  "status": "success",
  "transactionId": "d8f907cd-438a-45b4-a22c-0851338a7678",
  "signingTriggered": true
}
```

### Risk Insights (Dynamic contract call response)

Hypernative sends these as standalone risk insight alerts (no `fordefi-transaction-id` header). The server verifies the signature using a separate public key, then **extracts the victim contract address** from the alert's `details` field and executes an emergency response through Fordefi's web3 provider.

**How it works:**

1. The server parses the `Suspected Victim <...|0xADDRESS>` pattern from the risk insight details
2. Uses the extracted address as the target contract (e.g., a Curve pool under exploit)
3. Calls `remove_liquidity` on that contract to emergency-withdraw all LP tokens held by the configured Fordefi vault

The vault and chain are configured in `fordefi-response/config.ts`. The target contract is determined dynamically from each alert — no hardcoded contract address is needed.

**Payload:**
```json
{
  "id": "unique-webhook-message-id",
  "data": "{...JSON string containing riskInsight with details like 'Suspected Victim <0x32e6...|0x32e616f4f17d43f9a5cd9be0e294727187064cb3>'...}",
  "digitalSignature": "MEUCIQDIJuxkKN6lxJFKD/9FtMz7eK..."
}
```

**Response (success):**
```json
{
  "status": "success",
  "txHash": "0xabc123...",
  "victimAddress": "0x32e616f4f17d43f9a5cd9be0e294727187064cb3"
}
```

**Response (no victim address found):**
```json
{
  "status": "success",
  "contractCallSkipped": "no victim address found"
}
```

## Project Structure

```
webhooks/
├── webhooks_fordefi.ts              # Fordefi-only webhook server
├── webhooks_audit_logs.ts           # Audit-log security monitor (alerts + browse/replay routes)
├── webhooks_hypernative.ts          # Hypernative webhook server (actions + risk insights)
├── fordefi-response/                # Contract call response module
│   ├── config.ts                    # Vault, contract, and chain configuration
│   ├── get-provider.ts              # Fordefi web3 provider setup
│   ├── abi-call.ts                  # Emergency remove_liquidity call on victim contract
│   └── trigger-signing.ts           # Fordefi trigger-signing API call
├── keys/                            # Public keys for signature verification
│   ├── fordefi_public_key.pem       # Fordefi webhook signature key
│   ├── hypernative_public_key.pem   # Hypernative webhook action signature key
│   └── hypernative_public_key_2.pem # Hypernative risk insight signature key
├── event-examples/                  # Example payloads for reference
├── package.json
├── tsconfig.json
└── .env                             # Environment variables
```

## Environment Variables

### `webhooks_fordefi.ts`

| Variable | Required | Description |
|----------|----------|-------------|
| `FORDEFI_PUBLIC_KEY` | No* | Fordefi public key PEM content (fallback to file) |
| `PORT` | No | Server port (default: 8080) |

### `webhooks_audit_logs.ts`

| Variable | Required | Description |
|----------|----------|-------------|
| `FORDEFI_API_USER_TOKEN` | Yes | Fordefi API access token (ADMIN or VIEWER role) |
| `FORDEFI_PUBLIC_KEY` | No* | Fordefi public key PEM content (fallback to file) |
| `PORT` | No | Server port (default: 8080) |

### `webhooks_hypernative.ts`

| Variable | Required | Description |
|----------|----------|-------------|
| `FORDEFI_API_USER_TOKEN` | Yes | Fordefi API access token |
| `HYPERNATIVE_PUBLIC_KEY` | No* | Webhook action public key (fallback to file) |
| `HYPERNATIVE_PUBLIC_KEY_2` | No* | Risk insight public key (fallback to file) |
| `PORT` | No | Server port (default: 8080) |

*\*Falls back to the corresponding file in `keys/` if not set*

## Testing with ngrok

1. Start your webhook server: `npm run hypernative_server`
2. Expose locally: `ngrok http 8080`
3. Configure the ngrok URL in:
   - [Fordefi Console](https://app.fordefi.com) → Settings → Webhooks (for Fordefi events)
   - [Hypernative Console](https://app.hypernative.xyz) → Alert Channels (for Hypernative events)

## Learn More

**Fordefi:**
- [Webhook Guide](https://docs.fordefi.com/developers/webhooks)
- [API Reference](https://docs.fordefi.com/api/openapi/transactions)

**Hypernative (requires account):**
- [Hypernative Platform](https://app.hypernative.xyz)
