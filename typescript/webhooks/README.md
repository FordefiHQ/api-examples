# Fordefi Webhook Handler (TypeScript)

Two TypeScript Express.js webhook server implementations to choose from:

## Implementation Options

### 1. **Basic Fordefi Handler** (`webhooks_fordefi.ts`)
- ✅ **Fordefi webhooks only**: Processes transaction events and notifications from your Fordefi organization
- ✅ **Simple setup**: Only requires Fordefi public key for signature validation
- ✅ **Read-only**: Receives and logs webhook events without API interactions

### 2. **Advanced Handler with Hypernative** (`webhooks_hypernative.ts`)
- ✅ **Fordefi webhooks**: Processes transaction events and notifications from your Fordefi organization
- ✅ **Hypernative integration**: Receives real-time Web3 security alerts and automatically triggers transaction signing via Fordefi API
- ✅ **Smart routing**: Automatically detects and routes between Fordefi and Hypernative events
- ⚠️ **Requires API token**: Needs Fordefi API User Token for transaction signing functionality

## Which Implementation Should I Choose?

### Choose **Basic Handler** (`webhooks_fordefi.ts`) if:
- ✅ You only need to receive and log Fordefi webhook events
- ✅ You want a simple, minimal setup
- ✅ You don't need Hypernative integration

### Choose **Advanced Handler** (`webhooks_hypernative.ts`) if:
- ✅ You already have a Hypernative account
- ✅ You want Hypernative security monitoring integration
- ✅ You need automated transaction signing based on security alerts

## Prerequisites

### For Both Implementations:
- **Node.js 18+** 
- **npm** or **yarn**
- **Fordefi Public Key** - [Download from webhook docs](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)

### Additional for Advanced Handler (`webhooks_hypernative.ts`):
- **Fordefi API User Token** - [Get your token here](https://docs.fordefi.com/developers/getting-started/create-an-api-user)
- **Fordefi API Signer up and running** - [Learn more here](https://docs.fordefi.com/developers/getting-started/set-up-an-api-signer/api-signer-docker)
- **Hypernative Account** - [Sign up here](https://app.hypernative.xyz/)

## Installation

1. **Clone and navigate**
   ```bash
   cd api-examples/typescript/webhooks
   ```

2. **Install dependencies**
   ```bash
   npm install express axios dotenv
   npm install -D typescript @types/express @types/node ts-node nodemon
   ```

3. **Initialize TypeScript config**
   ```bash
   npx tsc --init
   ```

## Configuration

### Basic Handler (`webhooks_fordefi.ts`) Configuration

**Minimal setup - only needs Fordefi public key:**

   ```bash
   # Create keys directory
   mkdir keys
   
   # Save Fordefi public key
   # Download from: https://docs.fordefi.com/developers/webhooks#validate-a-webhook
   # Save as: keys/fordefi_public_key.pem
   ```

### Advanced Handler (`webhooks_hypernative.ts`) Configuration

**Full setup with API token and multiple keys:**

1. **Environment Variables**  
   Create a `.env` file:
   ```env
   # Fordefi Configuration
   FORDEFI_API_USER_TOKEN=your_fordefi_api_token_here
   FORDEFI_PUBLIC_KEY=your_fordefi_public_key_pem_content_here
   
   # Hypernative Configuration (optional - will use file if not provided)
   HYPERNATIVE_PUBLIC_KEY=your_hypernative_public_key_pem_content_here
   ```

2. **Public Key Setup**  
   The server supports loading public keys from both environment variables and files:
   
   **Option A: Environment Variables** (Recommended for production)
   ```env
   FORDEFI_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----
   HYPERNATIVE_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMFkwEwYHKo...\n-----END PUBLIC KEY-----
   ```
   
   **Option B: Key Files** (Good for development)
   ```bash
   # Create keys directory
   mkdir keys
   
   # Save Fordefi public key
   # Download from: https://docs.fordefi.com/developers/webhooks#validate-a-webhook
   # Save as: keys/fordefi_public_key.pem
   
   # Save Hypernative public key (optional)
   # Contact Hypernative support to get this key
   # Save as: keys/hypernative_public_key.pem
   ```

3. **Package.json Scripts**  
   Add these scripts to your `package.json`:
   ```json
   {
   "scripts": {
      "dev": "nodemon --exec ts-node webhooks_hypernative.ts",
      "build": "tsc",
      "fordefi_server": "npx tsx webhooks_fordefi.ts",
      "hypernative_server": "npx tsx webhooks_hypernative.ts"
   },
   }
   ```

## Usage

### Choose Your Implementation

**For Basic Fordefi-only webhooks:**
```bash
npm run fordefi_server
```

**For Advanced handler with Hypernative integration:**
```bash
# Development
npm run dev
# Production
npm run hypernative_server
```
## API Endpoints

### Basic Handler (`webhooks_fordefi.ts`)
| Method | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/health` | Health check endpoint |
| `POST` | `/` | Webhook endpoint for Fordefi events only |

### Advanced Handler (`webhooks_hypernative.ts`)
| Method | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/health` | Health check endpoint |
| `POST` | `/` | Smart webhook endpoint that routes Fordefi and Hypernative events automatically |

### Fordefi Webhook Flow (`POST /`)

**Basic Handler:**
1. **Signature Verification** - Validates `X-Signature` header using ECDSA P-256
2. **Event Processing** - Parses webhook payload and extracts transaction data
3. **Logging** - Logs complete transaction event details
4. **Response** - Returns success confirmation

**Advanced Handler:**
1. **Smart Detection** - Automatically detects if incoming webhook is from Fordefi or Hypernative
2. **Signature Verification** - Validates `X-Signature` header using ECDSA P-256 (for Fordefi events)
3. **Event Processing** - Parses webhook payload and extracts transaction data
4. **Logging** - Logs complete transaction event details
5. **Response** - Returns success confirmation

### Hypernative Webhook Flow (`POST /`) *(Advanced Handler Only)*

1. **Header Extraction** - Retrieves `fordefi-transaction-id` from headers
2. **Signature Verification** - Validates `digitalSignature` from request body using ECDSA P-256
3. **Alert Processing** - Parses risk insight data and security alerts
4. **Logging** - Logs detailed security alert information
5. **Transaction Signing** - Automatically triggers signing for the associated Fordefi transaction using the API
6. **Response** - Returns success confirmation with transaction ID and signing status

#### Hypernative Webhook Headers
```http
Content-Type: application/json
fordefi-transaction-id: d8f907cd-438a-45b4-a22c-0851338a7678
```

#### Hypernative Webhook Payload Structure
```json
{
  "id": "unique-webhook-message-id",
  "data": "{...JSON string containing riskInsight data...}",
  "digitalSignature": "MEYCIQCLpMfKwuubxs73AZ4l58+MGmpjVViiBiHOq5iDhQlc+Q..."
}
```

#### Hypernative Response Examples

**Successful Processing with Signing Trigger:**
```json
{
  "status": "success",
  "message": "Hypernative webhook received, processed, and signing triggered",
  "transactionId": "d8f907cd-438a-45b4-a22c-0851338a7678",
  "signingTriggered": true
}
```

**Processing Success but Signing Failed:**
```json
{
  "status": "partial_success",
  "message": "Hypernative webhook received and processed, but signing trigger failed",
  "transactionId": "d8f907cd-438a-45b4-a22c-0851338a7678",
  "signingTriggered": false
}
```

**Processing Success without Transaction ID:**
```json
{
  "status": "success",
  "message": "Hypernative webhook received and processed (no transaction ID to trigger)",
  "signingTriggered": false
}
```

### Fordefi Webhook Response Example
```json
{
  "status": "success",
  "message": "Fordefi webhook received and processed"
}
```

## Testing with ngrok

1. **Install ngrok**
   ```bash
   # Install ngrok: https://ngrok.com/download
   ```

2. **Start your webhook server**
   ```bash
   npm run dev
   ```

3. **Expose locally with ngrok**
   ```bash
   ngrok http 8080
   ```

4. **Configure Fordefi Webhook**
   - Go to [Fordefi Console](https://app.fordefi.com) → Settings → Webhooks
   - Add webhook URL: `https://your-ngrok-url.ngrok.io/`
   - Save and test

## Project Structure

```
webhooks/
├── webhooks_fordefi.ts             # Main application file (doesn't support Hypernative event )
├── webhooks_hypernative.ts         # Alternative application file (supports both Fordefi and Hypernative events)
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .env                           # Environment variables (optional)
├── keys/                          # Public keys directory
│   ├── fordefi_public_key.pem     # Fordefi webhook signature validation
│   └── hypernative_public_key.pem # Hypernative webhook signature validation (optional)
└── README.md                      # This file
```

## Environment Variables

### Basic Handler (`webhooks_fordefi.ts`)
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |

### Advanced Handler (`webhooks_hypernative.ts`)
| Variable | Required | Description |
|----------|----------|-------------|
| `FORDEFI_API_USER_TOKEN` | Yes | Your Fordefi API access token (required for transaction signing triggers) |
| `FORDEFI_PUBLIC_KEY` | No* | Fordefi public key PEM content (fallback to file) |
| `HYPERNATIVE_PUBLIC_KEY` | No* | Hypernative public key PEM content (fallback to file) |
| `PORT` | No | Server port (default: 8080) |

*\*Required only if not using key files*

## Automated Transaction Signing *(Advanced Handler Only)*

The Advanced Handler (`webhooks_hypernative.ts`) includes automated transaction signing functionality that allows Hypernative security alerts to trigger immediate transaction approval in Fordefi. This enables rapid response to security events.

> **Note:** This feature is **not available** in the Basic Handler (`webhooks_fordefi.ts`) which is read-only.

### How It Works

1. **Alert Reception**: Hypernative sends a security alert with a `fordefi-transaction-id` header
2. **Signature Validation**: The webhook verifies the alert's authenticity using ECDSA P-256
3. **API Call**: Upon successful validation, the server calls Fordefi's `/trigger-signing` API endpoint [see reference here](https://docs.fordefi.com/api/latest/openapi/transactions/trigger_transaction_signing_api_v1_transactions__id__trigger_signing_post)
4. **Response**: The webhook returns the signing trigger status along with alert processing confirmation

### API Endpoint Used

```http
POST https://api.fordefi.com/api/v1/transactions/{transactionId}/trigger-signing
Authorization: Bearer {FORDEFI_API_USER_TOKEN}
Content-Type: application/json
``
## Learn More

📚 **Documentation Links:**

**Fordefi:**
- [Fordefi Webhook Guide](https://docs.fordefi.com/developers/webhooks)
- [Fordefi API Reference](https://docs.fordefi.com/api/openapi/transactions)
- [Signature Validation](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)

**Hypernative (all links require a Hypernative account):**
- [Hypernative Platform](https://app.hypernative.xyz)
- [Fordefi Integration Guide](https://docs.hypernative.xyz/hypernative-product-docs/hypernative-web-application/configure-external-alert-channels/fordefi)
 