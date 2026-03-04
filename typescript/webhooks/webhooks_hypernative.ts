import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { p256 } from '@noble/curves/nist.js';
import express, { Request, Response } from 'express';
import { triggerFordefiSigning } from './fordefi-response/trigger-signing.js';
import { executeContractCall } from './fordefi-response/abi-call.js';

const app = express();
app.set('trust proxy', true);
app.use(express.raw({ type: 'application/json' }));
const PORT = Number(process.env.PORT) || 8080;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webhookActionKeyPath = path.join(__dirname, 'keys', 'hypernative_public_key.pem');
const riskInsightKeyPath = path.join(__dirname, 'keys', 'hypernative_public_key_2.pem');

let WEBHOOK_ACTION_PUBLIC_KEY: string;
let RISK_INSIGHT_PUBLIC_KEY: string;
let FORDEFI_API_USER_TOKEN: string;

try {
  FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN!;
  if (!FORDEFI_API_USER_TOKEN) {
    console.error('FORDEFI_API_USER_TOKEN environment variable is required');
    process.exit(1);
  }
} catch (error) {
  console.error('Error loading Fordefi API User Token:', error);
  process.exit(1);
}

try {
  WEBHOOK_ACTION_PUBLIC_KEY = process.env.HYPERNATIVE_PUBLIC_KEY
    ?? fs.readFileSync(webhookActionKeyPath, 'utf8');
} catch (error) {
  console.error('Error loading Hypernative webhook action public key:', error);
  process.exit(1);
}

try {
  RISK_INSIGHT_PUBLIC_KEY = process.env.HYPERNATIVE_PUBLIC_KEY_2
    ?? fs.readFileSync(riskInsightKeyPath, 'utf8');
} catch (error) {
  console.error('Error loading Hypernative risk insight public key:', error);
  process.exit(1);
}

function derToP1363(derSig: Uint8Array): Uint8Array {
  return p256.Signature.fromBytes(derSig, 'der').toBytes();
}

async function verifyEcdsaSignature(base64Signature: string, data: Buffer, publicKeyPem: string): Promise<boolean> {
  try {
    const pemContents = publicKeyPem
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

function parseRawBody(req: Request, res: Response): any | null {
  const rawBody = req.body as Buffer;
  if (!rawBody || rawBody.length === 0) {
    res.status(400).json({ error: 'Empty request body' });
    return null;
  }

  try {
    return JSON.parse(rawBody.toString());
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return null;
  }
}

function extractSignatureAndData(body: any, res: Response): { signature: string; data: string } | null {
  if (!body.digitalSignature) {
    res.status(401).json({ error: 'Missing digitalSignature' });
    return null;
  }
  if (!body.data) {
    res.status(400).json({ error: 'Missing data field' });
    return null;
  }
  return {
    signature: body.digitalSignature,
    data: typeof body.data === 'string' ? body.data : JSON.stringify(body.data),
  };
}

function logFordefiTriggeredAction(body: any, transactionId?: string) {
  const parsed = typeof body.data === 'string' ? tryParseJson(body.data) : body.data;
  const insight = parsed?.riskInsight;

  console.log('\n━━━ Hypernative Fordefi Trigerred Action ━━━');
  console.log(`  Message ID:      ${body.id}`);
  if (transactionId) {
    console.log(`  Transaction ID:  ${transactionId}`);
  }
  if (insight) {
    console.log(`  Chain:           ${insight.chain}`);
    console.log(`  Severity:        ${insight.severity}`);
    console.log(`  Category:        ${insight.category}`);
    console.log(`  Name:            ${insight.name}`);
    console.log(`  Details:         ${insight.details}`);
    console.log(`  Risk Type:       ${insight.riskTypeId} — ${insight.riskTypeDescription}`);
    if (insight.txnHash) {
      console.log(`  Tx Hash:         ${insight.txnHash}`);
    }
    if (insight.involvedAssets?.length) {
      for (const asset of insight.involvedAssets) {
        console.log(`  Asset:           ${asset.alias || asset.address} (${asset.type} on ${asset.chain})`);
      }
    }
  }
  if (parsed?.watchlists?.length) {
    console.log(`  Watchlists:      ${parsed.watchlists.map((w: any) => w.name).join(', ')}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function logRiskInsight(body: any) {
  const parsed = typeof body.data === 'string' ? tryParseJson(body.data) : body.data;
  const insight = parsed?.riskInsight;

  console.log('\n━━━ Hypernative Risk Insight ━━━');
  console.log(`  Message ID:      ${body.id}`);
  if (insight) {
    console.log(`  Chain:           ${insight.chain}`);
    console.log(`  Severity:        ${insight.severity}`);
    console.log(`  Category:        ${insight.category}`);
    console.log(`  Name:            ${insight.name}`);
    console.log(`  Details:         ${insight.details}`);
    console.log(`  Risk Type:       ${insight.riskTypeId} — ${insight.riskTypeDescription}`);
    if (insight.txnHash) {
      console.log(`  Tx Hash:         ${insight.txnHash}`);
    }
    if (insight.involvedAssets?.length) {
      for (const asset of insight.involvedAssets) {
        console.log(`  Asset:           ${asset.alias || asset.address} (${asset.type} on ${asset.chain})`);
      }
    }
  }
  if (parsed?.watchlists?.length) {
    console.log(`  Watchlists:      ${parsed.watchlists.map((w: any) => w.name).join(', ')}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function tryParseJson(str: string): any | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/hypernative', async (req: Request, res: Response): Promise<void> => {
  return handleWebhookAction(req, res);
});

app.post('/hypernative/risk-insights', async (req: Request, res: Response): Promise<void> => {
  return handleRiskInsight(req, res);
});

app.post('/', async (req: Request, res: Response): Promise<void> => {
  console.log(`\nClient IP: ${req.ip}`);
  try {
    const rawBody = req.body as Buffer;
    if (rawBody && rawBody.length > 0) {
      try {
        const bodyData = JSON.parse(rawBody.toString());
        if (bodyData.digitalSignature) {
          const transactionId = req.headers['fordefi-transaction-id'] as string;
          if (transactionId) {
            return handleWebhookAction(req, res);
          } else {
            return handleRiskInsight(req, res);
          }
        }
      } catch {
        // fall through
      }
    }

    res.status(400).json({ error: 'Unrecognized webhook payload' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleWebhookAction(req: Request, res: Response): Promise<void> {
  try {
    console.log('\nReceived Hypernative Fordefi Triggered Action');

    const body = parseRawBody(req, res);
    if (!body) return;

    const extracted = extractSignatureAndData(body, res);
    if (!extracted) return;

    const isValid = await verifyEcdsaSignature(extracted.signature, Buffer.from(extracted.data, 'utf8'), WEBHOOK_ACTION_PUBLIC_KEY);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    console.log('✅ Signature verified');
    logFordefiTriggeredAction(body, req.headers['fordefi-transaction-id'] as string);

    const transactionId = req.headers['fordefi-transaction-id'] as string;
    if (transactionId) {
      const signingTriggered = await triggerFordefiSigning(transactionId, FORDEFI_API_USER_TOKEN);
      res.status(200).json({
        status: signingTriggered ? 'success' : 'partial_success',
        transactionId,
        signingTriggered,
      });
    } else {
      res.status(200).json({ status: 'success', signingTriggered: false });
    }
  } catch (error) {
    console.error('Error processing webhook action:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRiskInsight(req: Request, res: Response): Promise<void> {
  try {
    console.log('\nReceived Hypernative risk insight');

    const body = parseRawBody(req, res);
    if (!body) return;

    const extracted = extractSignatureAndData(body, res);
    if (!extracted) return;

    const isValid = await verifyEcdsaSignature(extracted.signature, Buffer.from(extracted.data, 'utf8'), RISK_INSIGHT_PUBLIC_KEY);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    console.log('✅ Signature verified');
    logRiskInsight(body);

    try {
      const txHash = await executeContractCall();
      console.log(`✅ Contract call executed: ${txHash}`);
      res.status(200).json({ status: 'success', txHash });
    } catch (callError) {
      console.error('Contract call failed:', callError);
      res.status(200).json({ status: 'partial_success', contractCallError: String(callError) });
    }
  } catch (error) {
    console.error('Error processing risk insight:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

app.use((_error: Error, _req: Request, res: Response, _next: any) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪝 Hypernative webhook server running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Auto-routing endpoint: http://0.0.0.0:${PORT}/`);
  console.log(`📝 Webhook actions endpoint: http://0.0.0.0:${PORT}/hypernative`);
  console.log(`📝 Risk insights endpoint: http://0.0.0.0:${PORT}/hypernative/risk-insights`);
  console.log(`❤️ Health check endpoint: http://0.0.0.0:${PORT}/health`);
});

export default app;
