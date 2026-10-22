import fs from 'fs';
import * as crypto from 'crypto';

export async function signWithApiUserPrivateKey(privateKeyPath: string , payload: string): Promise<string> {
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');
  console.log('Payload signed with API User private key 🖋️🔑');

  return signature
}