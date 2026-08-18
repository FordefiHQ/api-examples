import * as crypto from "crypto";

function createSha256Signature(privateKeyPem: string, payload: string): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signer = crypto.createSign("SHA256").update(payload, "utf8").end();
  return signer.sign(privateKey, "base64");
}

export function signFordefiApiPayload(
  privateKeyPem: string,
  path: string,
  timestamp: number,
  requestBody: string
): string {
  const payload = `${path}|${timestamp}|${requestBody}`;
  return createSha256Signature(privateKeyPem, payload);
}
