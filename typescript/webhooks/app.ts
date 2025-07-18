import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { p256 } from '@noble/curves/p256';
import express, { Request, Response } from 'express';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 8080;

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN;
const FORDEFI_API_BASE = 'https://api.fordefi.com/api/v1';

const publicKeyPath = path.join(__dirname, 'public_key.pem');
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

interface TransactionData {
  id: string;
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

/**
 * Fetch transaction data from Fordefi API
 */
async function fetchTransactionData(transactionId: string): Promise<TransactionData | null> {
  if (!FORDEFI_API_USER_TOKEN) {
    console.error('FORDEFI_API_USER_TOKEN not configured');
    return null;
  }

  const fordefiUrl = `${FORDEFI_API_BASE}/transactions/${transactionId}`;
  const headers = {
    'Authorization': `Bearer ${FORDEFI_API_USER_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('Fetching transaction data for ID:', transactionId);
    const response = await axios.get(fordefiUrl, { headers });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Error fetching transaction data: ${error.response?.status} - ${error.response?.statusText}`);
      if (error.response?.data) {
        console.error('Error details:', error.response.data);
      }
    } else {
      console.error('Error fetching transaction data:', error);
    }
    return null;
  }
}

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

    // OPTIONAL: Write event data to file
    try {
      const eventFilePath = path.join(__dirname, 'v2_event_examples.json');
      const eventEntry = {
        timestamp: new Date().toISOString(),
        event: eventData
      };
      
      // Append the event to the file (one JSON object per line)
      fs.appendFileSync(eventFilePath, JSON.stringify(eventEntry) + '\n');
      console.log('Event saved to v2_event_examples.json');
    } catch (error) {
      console.error('Error writing event to file:', error);
    }

    // THIS IS THE LEGACY WORKFLOW, APPLICABLE FOR WEBHOOK V1 ONLY
    // 4. Extract the transaction_id from the data (if present)
    // const transactionId = eventData.event?.transaction_id;
    // let transactionData: TransactionData | null = null;

    // if (transactionId) {
    //   console.log('Transaction ID:', transactionId);
    //   transactionData = await fetchTransactionData(transactionId);
      
    //   if (transactionData) {
    //     console.log('Transaction data fetched successfully');
    //     // Uncomment to log full transaction data
    //     // console.log('Transaction data:', JSON.stringify(transactionData, null, 2));
    //   }
    // } else {
    //   console.log('transaction_id field not found in the event data.');
    // }

    // if (!transactionData) {
    //   console.log('No transaction data available');
    // }

    // // 5. Return the transaction data
    // res.json(transactionData || { message: 'Event processed successfully' });

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
  
  if (!FORDEFI_API_USER_TOKEN) {
    console.warn('⚠️  Warning: FORDEFI_API_USER_TOKEN not configured');
  }
});

export default app;