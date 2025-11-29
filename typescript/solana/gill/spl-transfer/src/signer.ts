import * as crypto from 'crypto';

export async function signWithApiUserPrivateKey(payload: string, privateKeyPem: string): Promise<string> {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');
  console.log("Payload signed with API Signer private key 🖋️✅");

  return signature;
}