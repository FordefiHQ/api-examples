import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { p256 } from '@noble/curves/nist.js';
import express, { Request, Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
app.use(express.raw({ type: 'application/json' }));
const PORT = Number(process.env.PORT) || 8080;

const fordefiPublicKeyPath = path.join(__dirname, 'keys', 'fordefi_public_key.pem');
const liveLogsDir = path.join(__dirname, 'live_logs', 'fordefi');
fs.mkdirSync(liveLogsDir, { recursive: true });

let FORDEFI_PUBLIC_KEY: string;

try {
  FORDEFI_PUBLIC_KEY = process.env.FORDEFI_PUBLIC_KEY
    ?? fs.readFileSync(fordefiPublicKeyPath, 'utf8');
} catch (error) {
  console.error('Error loading Fordefi public key:', error);
  process.exit(1);
}

function derToP1363(derSig: Uint8Array): Uint8Array {
  return p256.Signature.fromBytes(derSig, 'der').toBytes();
}

async function verifyEcdsaSignature(base64Signature: string, data: Buffer): Promise<boolean> {
  try {
    const pemContents = FORDEFI_PUBLIC_KEY
      .replace(/\\n/g, '\n')
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');

    const publicKey = await crypto.subtle.importKey(
      'spki',
      new Uint8Array(Buffer.from(pemContents, 'base64')),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    const derBytes = new Uint8Array(Buffer.from(base64Signature, 'base64'));
    const ieeeSignature = derToP1363(derBytes);

    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      new Uint8Array(ieeeSignature),
      new Uint8Array(data)
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function logFordefiEvent(event: any) {
  const tx = event.managed_transaction_data ?? event;
  const vault = tx.vault ?? tx.managed_transaction_data?.vault;
  const stateChanges = event.state_changes ?? [];
  const latestState = stateChanges.at(-1);

  console.log('\n━━━ Fordefi Event ━━━');
  console.log(`  ID:      ${event.id}`);
  console.log(`  State:   ${event.state}`);
  if (vault) {
    console.log(`  Vault:   ${vault.name} (${vault.address})`);
  }
  if (event.direction) {
    console.log(`  Direction: ${event.direction}`);
  }
  if (tx.created_by) {
    console.log(`  Created by: ${tx.created_by.name} (${tx.created_by.email})`);
  }
  if (tx.policy_match) {
    console.log(`  Policy:  ${tx.policy_match.rule_name || 'default'} → ${tx.policy_match.action_type}`);
  }
  if (latestState) {
    console.log(`  Latest state change: ${latestState.new_state} at ${latestState.changed_at}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━');
  console.log('Full payload:', JSON.stringify(event, null, 2));
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const headerSignature = req.headers['x-signature'] as string;
    if (!headerSignature) {
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    const rawBody = req.body as Buffer;
    if (!rawBody || rawBody.length === 0) {
      res.status(400).json({ error: 'Empty request body' });
      return;
    }

    const isValid = await verifyEcdsaSignature(headerSignature, rawBody);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    console.log('✅ Signature verified');
    const event = JSON.parse(rawBody.toString());
    logFordefiEvent(event);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(liveLogsDir, `${timestamp}_${event.id ?? 'unknown'}.json`);
    fs.writeFileSync(logFile, JSON.stringify(event, null, 2));
    console.log(`📄 Logged to ${logFile}`);

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((_error: Error, _req: Request, res: Response, _next: any) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪝 Fordefi webhook server running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Webhook endpoint: http://0.0.0.0:${PORT}`);
  console.log(`❤️ Health check endpoint: http://0.0.0.0:${PORT}/health`);
});

export default app;
