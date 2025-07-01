# Fordefi Webhook Handler (TypeScript)

A TypeScript Express.js webhook server that listens for events from your Fordefi organization and processes transaction data.

## Prerequisites

- **Node.js 18+** 
- **npm** or **yarn**
- **Fordefi API User Token** - [Get your token here](https://docs.fordefi.com/developers/program-overview)
- **Fordefi Public Key** - [Download from webhook docs](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)

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
   FORDEFI_API_USER_TOKEN=your_fordefi_api_token_here
   PORT=8080
   ```

2. **Public Key Setup**  
   Download the Fordefi public key and save it as `public_key.pem` in the same directory:
   ```bash
   # Download from: https://docs.fordefi.com/developers/webhooks#validate-a-webhook
   # Save as: public_key.pem
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
npx ts-node app.ts
```

## API Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/` | Main webhook endpoint for Fordefi events |

### Webhook Request Flow

1. **Signature Verification** - Validates X-Signature header using ECDSA P-256
2. **Event Processing** - Parses webhook payload and extracts transaction ID
3. **Data Fetching** - Retrieves full transaction data from Fordefi API
4. **Response** - Returns transaction data or success message

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
├── app.ts              # Main application file
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── .env               # Environment variables
├── public_key.pem     # Fordefi public key
└── README.md          # This file
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FORDEFI_API_USER_TOKEN` | Yes | Your Fordefi API access token |
| `PORT` | No | Server port (default: 8080) |

## Learn More

📚 **Documentation Links:**
- [Fordefi Webhook Guide](https://docs.fordefi.com/developers/webhooks)
- [Fordefi API Reference](https://docs.fordefi.com/api/openapi/transactions)
- [Signature Validation](https://docs.fordefi.com/developers/webhooks#validate-a-webhook)
 