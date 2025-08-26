# Fordefi Webhook Handler (TypeScript)

A TypeScript Express.js webhook server that handles webhooks from multiple sources:
- **Fordefi**: Processes transaction events and notifications from your Fordefi organization
- **Hypernative** *(Optional)*: Receives real-time Web3 security alerts and triggers automated responses via Fordefi

## Prerequisites

- **Node.js 18+** 
- **npm** or **yarn**
- **Fordefi API User Token** - [Get your token here](https://docs.fordefi.com/developers/program-overview)
- **Fordefi Public Key** - [Download from webhook docs](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)

### Optional (for Hypernative integration):
- **Hypernative Public Key** - Contact Hypernative support for webhook signature validation
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

1. **Environment Variables**  
   Create a `.env` file:
   ```env
   # Fordefi Configuration
   FORDEFI_API_USER_TOKEN=your_fordefi_api_token_here
   FORDEFI_PUBLIC_KEY=your_fordefi_public_key_pem_content_here
   
   # Hypernative Configuration (optional - will use file if not provided)
   HYPERNATIVE_PUBLIC_KEY=your_hypernative_public_key_pem_content_here
   
   # Server Configuration
   PORT=8080
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
       "dev": "nodemon --exec ts-node app.ts",
       "build": "tsc",
       "start": "node dist/app.js"
     }
   }
   ```

## Usage

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Direct Execution
```bash
npx tsx webhooks_server.ts
```

## API Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/health` | Health check endpoint |
| `POST` | `/` | Main webhook endpoint for Fordefi events |
| `POST` | `/hypernative` | Webhook endpoint for Hypernative security alerts *(optional)* |

### Fordefi Webhook Flow (`POST /`)

1. **Signature Verification** - Validates `X-Signature` header using ECDSA P-256
2. **Event Processing** - Parses webhook payload and extracts transaction data
3. **Logging** - Logs complete transaction event details
4. **Response** - Returns success confirmation

### Hypernative Webhook Flow (`POST /hypernative`) *(Optional)*

1. **Header Extraction** - Retrieves `fordefi-transaction-id` from headers
2. **Signature Verification** - Validates `digitalSignature` from request body using ECDSA P-256
3. **Alert Processing** - Parses risk insight data and security alerts
4. **Logging** - Logs detailed security alert information
5. **Response** - Returns success confirmation with transaction ID

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

### Example Response
```json
{
  "id": "transaction_id_here",
  "status": "completed",
  "blockchain": "ethereum",
  "type": "transfer",
  // ... additional transaction data
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
├── app.ts                          # Main application file
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .env                           # Environment variables (optional)
├── keys/                          # Public keys directory
│   ├── fordefi_public_key.pem     # Fordefi webhook signature validation
│   └── hypernative_public_key.pem # Hypernative webhook signature validation (optional)
└── README.md                      # This file
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FORDEFI_API_USER_TOKEN` | No* | Your Fordefi API access token (for API calls) |
| `FORDEFI_PUBLIC_KEY` | No* | Fordefi public key PEM content (fallback to file) |
| `HYPERNATIVE_PUBLIC_KEY` | No* | Hypernative public key PEM content (fallback to file) |
| `PORT` | No | Server port (default: 8080) |

*\*Required only if not using key files*

## Hypernative Integration Setup *(Optional)*

### 1. Configure Hypernative Webhook Channel
1. Login to [Hypernative Platform](https://app.hypernative.xyz)
2. Navigate to **Channels** → **Add Channel** → **Webhook**
3. Set webhook URL: `https://your-domain.com/hypernative`
4. Configure any additional headers if needed

### 2. Configure Fordefi Integration in Hypernative
1. In Hypernative, go to **Channels** → **Add Channel** → **Fordefi**
2. Enter your webhook URL: `https://your-domain.com/hypernative`
3. Configure the `fordefi-transaction-id` header with your prepared transaction ID
4. Connect this channel to your Watchlists or Custom Agents

### 3. Test the Integration
1. Create a test alert in Hypernative
2. Verify the webhook receives the alert with proper signature validation
3. Check logs for successful processing

## Security Features

- ✅ **ECDSA P-256 Signature Verification** for both Fordefi and Hypernative webhooks
- ✅ **Environment Variable Support** for secure key management
- ✅ **Fallback to File Keys** for development environments
- ✅ **Request Validation** with proper error handling
- ✅ **Detailed Logging** for debugging and monitoring

## Learn More

📚 **Documentation Links:**

**Fordefi:**
- [Fordefi Webhook Guide](https://docs.fordefi.com/developers/webhooks)
- [Fordefi API Reference](https://docs.fordefi.com/api/openapi/transactions)
- [Signature Validation](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)

**Hypernative (all links require a Hypernative account):**
- [Hypernative Platform](https://app.hypernative.xyz)
- [Webhook Alert Structure](https://docs.hypernative.xyz/hypernative-product-docs/developers/api-contents/notification-channels/webhook-alert-structure)
- [Fordefi Integration Guide](https://docs.hypernative.xyz/hypernative-product-docs/hypernative-web-application/configure-external-alert-channels/fordefi)
 