import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { p256 } from '@noble/curves/p256';
import express, { Request, Response } from 'express';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 8080;

// Public Keys file paths
const fordefiPublicKeyPath = path.join(__dirname, 'keys', 'fordefi_public_key.pem');
const hypernativePublicKeyPath = path.join(__dirname, 'keys', 'hypernative_public_key.pem');

let FORDEFI_PUBLIC_KEY: string;
let HYPERNATIVE_PUBLIC_KEY: string;

// Load Fordefi public key (try env first, then file)
try {
  if (process.env.FORDEFI_PUBLIC_KEY) {
    FORDEFI_PUBLIC_KEY = process.env.FORDEFI_PUBLIC_KEY;
    console.log('✅ Loaded Fordefi public key from environment variable');
  } else {
    FORDEFI_PUBLIC_KEY = fs.readFileSync(fordefiPublicKeyPath, 'utf8');
    console.log('✅ Loaded Fordefi public key from file');
  }
} catch (error) {
  console.error('❌ Error loading Fordefi public key:', error);
  process.exit(1);
}

// Load Hypernative public key (try env first, then file)
try {
  if (process.env.HYPERNATIVE_PUBLIC_KEY) {
    HYPERNATIVE_PUBLIC_KEY = process.env.HYPERNATIVE_PUBLIC_KEY;
    console.log('✅ Loaded Hypernative public key from environment variable');
  } else {
    HYPERNATIVE_PUBLIC_KEY = fs.readFileSync(hypernativePublicKeyPath, 'utf8');
    console.log('✅ Loaded Hypernative public key from file');
  }
} catch (error) {
  console.error('❌ Error loading Hypernative public key:', error);
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
 * Verify Hypernative webhook signature using ECDSA with SHA-256
 */
async function verifyHypernativeSignature(signature: string, body: Buffer): Promise<boolean> {
  try {
    const normalizedPem = HYPERNATIVE_PUBLIC_KEY.replace(/\\n/g, '\n');
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

    console.log('Hypernative signature verification debug:', {
      signatureLength: derSignatureBytes.length,
      dataLength: body.length,
      signature: signature.substring(0, 20) + '...',
      dataPreview: body.slice(0, 100).toString() + '...',
      publicKeyLoaded: HYPERNATIVE_PUBLIC_KEY ? 'Yes' : 'No',
      hashAlgorithm: 'SHA-256'
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

    console.log(`Hypernative signature verification result: ${isValid}`);
    return isValid;

  } catch (error) {
    console.error('Hypernative signature verification error:', error);
    return false;
  }
}

/**
 * Verify Fordefi webhook signature using ECDSA with SHA-256
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

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Hypernative webhook endpoint
 */
app.post('/hypernative', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('\n🔥 Received Hypernative webhook');
    
    // 1. Get the fordefi-transaction-id from headers
    const transactionId = req.headers['fordefi-transaction-id'] as string;
    console.log(`📋 Transaction ID: ${transactionId}`);
    
    // 2. Get the raw body
    const rawBody = req.body as Buffer;
    if (!rawBody || rawBody.length === 0) {
      console.error('Empty request body');
      res.status(400).json({ error: 'Empty request body' });
      return;
    }

    // 3. Parse the JSON data
    const hypernativeData = JSON.parse(rawBody.toString());
    
    // 4. Get digitalSignature from the body
    const digitalSignature = hypernativeData.digitalSignature;
    if (!digitalSignature) {
      console.error('Missing digitalSignature in request body');
      res.status(401).json({ error: 'Missing digitalSignature' });
      return;
    }

    // 5. Verify the signature against the 'data' field only
    const dataToVerify = Buffer.from(hypernativeData.data, 'utf8');
    const isValidSignature = await verifyHypernativeSignature(digitalSignature, dataToVerify);
    if (!isValidSignature) {
      console.error('Invalid Hypernative signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    console.log('\n📝 Hypernative Event Data:');
    console.log(JSON.stringify(hypernativeData, null, 2));
    
    // Parse the nested data string if it exists
    if (hypernativeData.data && typeof hypernativeData.data === 'string') {
      try {
        const parsedData = JSON.parse(hypernativeData.data);
        console.log('\n📊 Parsed Risk Insight:');
        console.log(JSON.stringify(parsedData, null, 2));
      } catch (error) {
        console.error('Error parsing nested data:', error);
      }
    }

    // 6. Respond OK
    res.status(200).json({ 
      status: 'success',
      message: 'Hypernative webhook received and processed',
      transactionId: transactionId
    });

  } catch (error) {
    console.error('Error processing Hypernative webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Webhook endpoint that listens for Fordefi events
 */
app.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
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
  console.log(`📝 Fordefi webhook endpoint: http://0.0.0.0:${PORT}/`);
  console.log(`🔥 Hypernative webhook endpoint: http://0.0.0.0:${PORT}/hypernative`);
  console.log(`❤️ Health check endpoint: http://0.0.0.0:${PORT}/health`);
});

export default app;