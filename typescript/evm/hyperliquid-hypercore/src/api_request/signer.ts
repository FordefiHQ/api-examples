import fs from 'fs';
import * as crypto from 'crypto';

/**
 * Parsed keys, cached by path.
 *
 * Every Fordefi request signs its own payload, including each poll iteration, so a
 * single waitForTerminal run would otherwise re-read and re-parse the PEM 30+ times
 * and leave that many copies of the key text in the heap. Caching the KeyObject keeps
 * one parsed handle instead.
 */
const keyCache = new Map<string, crypto.KeyObject>();

function loadPrivateKey(privateKeyPath: string): crypto.KeyObject {
  const cached = keyCache.get(privateKeyPath);
  if (cached) return cached;

  let privateKeyPem: string;
  try {
    privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'File not found.'
      : 'Check that the file exists and is readable.';
    throw new Error(`Unable to read the Fordefi API signer key at ${privateKeyPath}. ${reason}`);
  }

  let privateKey: crypto.KeyObject;
  try {
    // Deliberately does not interpolate the underlying error, which for an encrypted
    // or malformed key can echo parts of the file back into logs.
    privateKey = crypto.createPrivateKey(privateKeyPem);
  } catch {
    throw new Error(
      `The file at ${privateKeyPath} is not a valid unencrypted PEM private key.`,
    );
  }

  keyCache.set(privateKeyPath, privateKey);
  return privateKey;
}

export async function signWithApiUserPrivateKey(privateKeyPath: string, payload: string): Promise<string> {
  const privateKey = loadPrivateKey(privateKeyPath);
  return crypto.createSign('SHA256').update(payload, 'utf8').end().sign(privateKey, 'base64');
}
