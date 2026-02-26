import * as crypto from 'crypto';

export async function signWithPrivateKey(payload: string, privateKeyPem: string): Promise<string> {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');
  console.log("API payload signed");

  return signature;
}