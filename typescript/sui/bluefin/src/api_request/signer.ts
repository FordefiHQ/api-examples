import fs from 'fs';
import * as crypto from 'crypto';

const privateKeyPem = fs.readFileSync('./fordefi_secret/private.pem', 'utf8');

export async  function signWithApiSigner(payload: string): Promise<string> {

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');
  console.log('Payload signed by API Signer 🖋️')

  return signature
}