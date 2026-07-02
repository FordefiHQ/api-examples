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
const ALLOWED_IPS = ['54.243.103.88']; // Fordefi's NAT IP
const FORDEFI_API_BASE_URL = 'https://api.fordefi.com';
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN;

// Audit-log categories that should raise a security alert. The remaining
// categories (vaults, address_book, address_group, vault_group, chains,
// dapp_group) are logged as informational.
const SENSITIVE_CATEGORIES = new Set([
  'policy',
  'quorum_threshold',
  'user_management',
  'user_group',
  'authentication',
  'aml_policy',
  'webhook',
  'backup',
  'device_backup',
  'import_keys',
]);

const fordefiPublicKeyPath = path.join(__dirname, 'keys', 'fordefi_public_key.pem');
const liveLogsDir = path.join(__dirname, 'live_logs', 'audit');
const alertsLogsDir = path.join(__dirname, 'live_logs', 'audit_alerts');
fs.mkdirSync(liveLogsDir, { recursive: true });
fs.mkdirSync(alertsLogsDir, { recursive: true });

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

function describeActor(createdBy: any): string {
  if (!createdBy || typeof createdBy !== 'object') return 'unknown';
  return createdBy.name ?? createdBy.email ?? createdBy.type ?? 'unknown';
}

function logEventToFile(dir: string, event: any) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(dir, `${timestamp}_${event.event_id ?? 'unknown'}.json`);
  fs.writeFileSync(logFile, JSON.stringify(event, null, 2));
  console.log(`📄 Logged to ${logFile}`);
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const sourceIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    console.log(`📡 Incoming webhook from IP: ${sourceIp}`);

    if (!ALLOWED_IPS.includes(sourceIp)) {
      console.warn(`⛔ Rejected request from unauthorized IP: ${sourceIp}`);
      res.status(403).json({ error: 'Forbidden: IP not whitelisted' });
      return;
    }

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
    const auditRecord = event.event;

    if (!auditRecord || typeof auditRecord !== 'object' || !('category' in auditRecord)) {
      // Not an audit-log event (e.g. a transaction webhook pointed here)
      console.log(`📝 Received non-audit event (event_type: ${event.event_type})`);
      logEventToFile(liveLogsDir, event);
      res.status(200).json({ status: 'success' });
      return;
    }

    if (SENSITIVE_CATEGORIES.has(auditRecord.category)) {
      console.log('\n🚨 SECURITY ALERT — sensitive audit event');
      console.log(`  Category:  ${auditRecord.category}`);
      console.log(`  Action:    ${auditRecord.action}`);
      console.log(`  Actor:     ${describeActor(auditRecord.created_by)}`);
      console.log(`  Client IP: ${auditRecord.client_ip}`);
      console.log(`  Details:   ${auditRecord.description}`);
      logEventToFile(alertsLogsDir, event);
    } else {
      console.log(`\n📝 Audit event: [${auditRecord.category}] ${auditRecord.description}`);
      logEventToFile(liveLogsDir, event);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin route: browse audit-log records via GET /api/v1/audit-log
app.get('/audit-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const params = new URLSearchParams();
    for (const key of ['page', 'size', 'created_after', 'created_before']) {
      const value = req.query[key];
      if (typeof value === 'string') params.append(key, value);
    }
    const categories = req.query.category;
    for (const category of Array.isArray(categories) ? categories : [categories]) {
      if (typeof category === 'string') params.append('category', category);
    }

    const response = await fetch(`${FORDEFI_API_BASE_URL}/api/v1/audit-log?${params}`, {
      headers: { Authorization: `Bearer ${FORDEFI_API_USER_TOKEN}` },
    });
    const body = await response.json();
    res.status(response.status).json(body);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin route: re-deliver an audit-log record to configured webhooks
app.post('/replay/:recordId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { recordId } = req.params;
    const response = await fetch(
      `${FORDEFI_API_BASE_URL}/api/v1/webhooks/trigger/audit-log/${recordId}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${FORDEFI_API_USER_TOKEN}` },
      }
    );
    if (!response.ok) {
      res.status(response.status).json(await response.json());
      return;
    }
    res.status(200).json({ status: 'replayed', audit_log_id: recordId });
  } catch (error) {
    console.error('Error replaying audit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((_error: Error, _req: Request, res: Response, _next: any) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪝 Fordefi audit-log webhook server running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Webhook endpoint: http://0.0.0.0:${PORT}`);
  console.log(`🗂️ Audit-log browse endpoint: http://0.0.0.0:${PORT}/audit-logs`);
  console.log(`🔁 Replay endpoint: POST http://0.0.0.0:${PORT}/replay/:recordId`);
  console.log(`❤️ Health check endpoint: http://0.0.0.0:${PORT}/health`);
});

export default app;
