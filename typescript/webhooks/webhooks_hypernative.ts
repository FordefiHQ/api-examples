import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { p256 } from '@noble/curves/p256';
import express, { Request, Response } from 'express';

const app = express();
app.set('trust proxy', true);
app.use(express.raw({ type: 'application/json' }));
const PORT = Number(process.env.PORT) || 8080;

// SECRETS and ENV VARIABLES

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fordefiPublicKeyPath = path.join(__dirname, 'keys', 'fordefi_public_key.pem');
const hypernativePublicKeyPath = path.join(__dirname, 'keys', 'hypernative_public_key.pem');

let FORDEFI_PUBLIC_KEY: string;
let HYPERNATIVE_PUBLIC_KEY: string;
let FORDEFI_API_USER_TOKEN: string;

try {
  FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN!;
  if (!FORDEFI_API_USER_TOKEN) {
    console.error('❌ FORDEFI_API_USER_TOKEN environment variable is required');
    process.exit(1);
  }
  console.log('✅ Loaded Fordefi API User Token from environment variable');
} catch (error) {
  console.error('❌ Error loading Fordefi API User Token:', error);
  process.exit(1);
}

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

/// APP LOGIC

interface WebhookEvent {
  event?: {
    transaction_id?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Trigger signing for a Fordefi transaction
 */
async function triggerTransactionSigning(transactionId: string): Promise<boolean> {
  try {
    console.log(`🔑 Triggering signing for transaction: ${transactionId}`);
    
    const response = await axios.post(
      `https://api.fordefi.com/api/v1/transactions/${transactionId}/trigger-signing`,
      {}, // Empty body for POST request
      {
        headers: {
          'Authorization': `Bearer ${FORDEFI_API_USER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true, // Don't throw on HTTP error status
      }
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ Successfully triggered signing for transaction: ${transactionId}`);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      console.error(`❌ Failed to trigger signing for transaction: ${transactionId}`);
      console.error(`Status: ${response.status}`);
      console.error('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Error triggering signing for transaction: ${transactionId}`, error);
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
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
  return handleHypernativeWebhook(req, res);
});

/**
 * Handle Hypernative webhook logic
 */
async function handleHypernativeWebhook(req: Request, res: Response): Promise<void> {
  try {
    console.log('\n⚡ Received Hypernative webhook');
    
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

    // 6. Trigger signing for the transaction if we have a valid transaction ID
    if (transactionId) {
      const signingTriggered = await triggerTransactionSigning(transactionId);
      
      // 7. Respond with success/failure based on signing trigger result
      if (signingTriggered) {
        res.status(200).json({ 
          status: 'success',
          message: 'Hypernative webhook received, processed, and signing triggered',
          transactionId: transactionId,
          signingTriggered: true
        });
      } else {
        res.status(200).json({ 
          status: 'partial_success',
          message: 'Hypernative webhook received and processed, but signing trigger failed',
          transactionId: transactionId,
          signingTriggered: false
        });
      }
    } else {
      console.warn('⚠️ No transaction ID provided, skipping signing trigger');
      res.status(200).json({ 
        status: 'success',
        message: 'Hypernative webhook received and processed (no transaction ID to trigger)',
        signingTriggered: false
      });
    }

  } catch (error) {
    console.error('Error processing Hypernative webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Main webhook endpoint that smartly routes between Fordefi and Hypernative events
 */
app.post('/', async (req: Request, res: Response): Promise<void> => {
    console.log(`\n🌐 Client IP: ${req.ip}`);
    try {
      console.log(req.headers)
      // Check if this might be a Hypernative event by looking for transaction ID header and digitalSignature in body
      const transactionId = req.headers['fordefi-transaction-id'] as string;
      const rawBody = req.body as Buffer;
      
      if (transactionId && rawBody && rawBody.length > 0) {
        try {
          const bodyData = JSON.parse(rawBody.toString());
          if (bodyData.digitalSignature) {
            console.log('\n🔄 Detected Hypernative event on main endpoint, routing...');
            return handleHypernativeWebhook(req, res);
          }
        } catch (parseError) {
          // Continue with Fordefi handling if JSON parsing fails
        }
      }

      // Handle as Fordefi event
      // 1. Get the signature from headers
      const signature = req.headers['x-signature'] as string;
      if (!signature) {
        console.error('Missing X-Signature header - this might be a Hypernative event sent to wrong endpoint');
        console.error('Hypernative events should be sent to /hypernative endpoints');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }
  
      // 2. Get the raw body
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

    console.log('\n 🏰 Received Fordefi event:');
    const eventData: WebhookEvent = JSON.parse(rawBody.toString());
    console.log(JSON.stringify(eventData, null, 2));

    // 4. Respond Ok
    res.status(200).json({ 
      status: 'success',
      message: 'Fordefi webhook received and processed'
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
  console.log(`📝 Main webhook endpoint with smart routing: http://0.0.0.0:${PORT}/`);
  console.log(`❤️ Health check endpoint: http://0.0.0.0:${PORT}/health`);
});

export default app;