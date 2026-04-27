import * as crypto from 'crypto';

export async function signWithPrivateKey(payload: string, privateKeyPem: string): Promise<string> {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
    return sign.sign(privateKey, 'base64');
}
