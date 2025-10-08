import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { p256 } from '@noble/curves/p256';
import express, { Request, Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
const PORT = Number(process.env.PORT) || 8080;

const publicKeyPath = path.join(__dirname, 'keys', 'fordefi_public_key.pem')
let FORDEFI_PUBLIC_KEY: string;

try {
    FORDEFI_PUBLIC_KEY = fs.readFileSync(publicKeyPath, 'utf8');
  } catch (error) {
    console.error('Error loading public key:', error);
    process.exit(1);
  }
  
app.use(express.raw({ type: 'application/json' }));

interface WebhookEvent {
  event?: {
    transaction_id?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Parse and convert from DER format to IEEE P1363
 */
function derToP1363(derSig: Uint8Array): Uint8Array {
  const signature = p256.Signature.fromDER(derSig).toCompactRawBytes();

  return signature;
}

/**
 * Verify webhook signature using ECDSA with SHA-256
 */
async function verifySignature(signature: string, body: Buffer): Promise<boolean> {
  try {
    const normalizedPem = FORDEFI_PUBLIC_KEY.replace(/\\n/g, '\n');
    const pemContents = normalizedPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    
    const publicKeyBytes = new Uint8Array(
      Buffer.from(pemContents, 'base64')
    );

    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBytes,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['verify']
    );

    // Decode the base64 signature (DER format)
    const derSignatureBytes = new Uint8Array(
      Buffer.from(signature, 'base64')
    );

    console.log('Signature verification debug:', {
      signatureLength: derSignatureBytes.length,
      dataLength: body.length,
      signature: signature.substring(0, 20) + '...',
      dataPreview: body.slice(0, 50).toString() + '...'
    });

    // Convert DER signature to IEEE P1363 format
    const ieeeSignature = derToP1363(derSignatureBytes);

    // Verify using IEEE P1363 format signature
    const isValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      publicKey,
      ieeeSignature,
      body
    );

    console.log(`Signature verification result: ${isValid}`);
    return isValid;

  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      console.log(`\n🌐 Client IP: ${req.ip}`);

      // 1. Get the signature from headers
      const signature = req.headers['x-signature'] as string;
      if (!signature) {
        console.error('Missing X-Signature header');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }
  
      // 2. Get the raw body
      const rawBody = req.body as Buffer;
      if (!rawBody || rawBody.length === 0) {
        console.error('Empty request body');
        res.status(400).json({ error: 'Empty request body' });
        return;
      }
  
      // 3. Verify the signature
      const isValidSignature = await verifySignature(signature, rawBody);
      if (!isValidSignature) {
        console.error('Invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

    console.log('\n📝 Received event:');
    const eventData: WebhookEvent = JSON.parse(rawBody.toString());
    console.log(JSON.stringify(eventData, null, 2));

    // 4. Respond Ok
    res.status(200).json({ 
      status: 'success',
      message: 'Webhook received and processed'
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((error: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪝 Fordefi webhook server running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Webhook endpoint: http://0.0.0.0:${PORT}`);
  console.log(`❤️ Health check endpoint: http://0.0.0.0:${PORT}/health`);
});

export default app;