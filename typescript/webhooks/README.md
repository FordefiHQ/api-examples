# Fordefi Webhook Handlers (TypeScript)

Two TypeScript Express.js webhook servers:

## Implementation Options

### 1. Fordefi Handler (`webhooks_fordefi.ts`)
- Receives and logs Fordefi transaction webhook events
- Verifies `X-Signature` header using ECDSA P-256
- Read-only — no API calls, only requires Fordefi public key

### 2. Hypernative Handler (`webhooks_hypernative.ts`)
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

### `webhooks_hypernative.ts`

1. Create a `.env` file:
   ```env
   FORDEFI_API_USER_TOKEN=your_fordefi_api_token_here
   ```

2. Place Hypernative public keys in `keys/`:
   - `keys/hypernative_public_key.pem` — for webhook actions (or set `HYPERNATIVE_PUBLIC_KEY` env var)
   - `keys/hypernative_public_key_2.pem` — for risk insights (or set `HYPERNATIVE_PUBLIC_KEY_2` env var)

3. Configure the contract call response in `fordefi-response/config.ts`:
   - Set the vault address, chain ID, contract address, destination, and ABI parameters
   - Place your Fordefi API signer private key at `fordefi-response/fordefi_secret/private.pem`

## Usage

```bash
# Fordefi-only webhooks
npm run fordefi_server

# Hypernative webhooks
npm run hypernative_server
```

## API Endpoints

### `webhooks_fordefi.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/` | Fordefi webhook events |

### `webhooks_hypernative.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/` | Auto-routes between webhook actions and risk insights |
| `POST` | `/hypernative` | Webhook actions — verifies signature, triggers Fordefi transaction signing |
| `POST` | `/hypernative/risk-insights` | Risk insights — verifies signature, executes contract call via Fordefi |

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

### Risk Insights (Custom contract call response)

Hypernative sends these as standalone risk insight alerts (no `fordefi-transaction-id` header). The server verifies the signature using a separate public key and responds by executing a contract call through Fordefi's web3 provider. The contract call is configured in `fordefi-response/config.ts`.

**Payload:**
```json
{
  "id": "unique-webhook-message-id",
  "data": "{...JSON string containing riskInsight data...}",
  "digitalSignature": "MEUCIQDIJuxkKN6lxJFKD/9FtMz7eK..."
}
```

**Response:**
```json
{
  "status": "success",
  "txHash": "0xabc123..."
}
```

## Project Structure

```
webhooks/
├── webhooks_fordefi.ts              # Fordefi-only webhook server
├── webhooks_hypernative.ts          # Hypernative webhook server (actions + risk insights)
├── fordefi-response/                # Contract call response module
│   ├── config.ts                    # Vault, contract, and chain configuration
│   ├── get-provider.ts              # Fordefi web3 provider setup
│   ├── abi-call.ts                  # Contract call execution
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
- [Signature Validation](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)

**Hypernative (requires account):**
- [Hypernative Platform](https://app.hypernative.xyz)
- [Fordefi Integration Guide](https://docs.hypernative.xyz/hypernative-product-docs/hypernative-web-application/configure-external-alert-channels/fordefi)
