import { Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import axios from "axios";
import { FordefiConfig } from "../config";
import { signWithPrivateKey } from "../signer";

/**
 * Sign the rotation challenge with the deployer's local Ed25519 private key.
 */
export function signWithOldKey(
  challengeBytes: Uint8Array,
  privateKeyHex: string
): Uint8Array {
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const signature = privateKey.sign(challengeBytes);
  return signature.toUint8Array();
}

/**
 * Sign the rotation challenge bytes using the Fordefi vault via raw message signing API.
 *
 * Sends the challenge as a base64-encoded raw payload to Fordefi,
 * polls until the signature is available, and returns the raw signature bytes.
 */
export async function signWithFordefi(
  challengeBytes: Uint8Array,
  fordefiConfig: FordefiConfig,
  vaultId: string,
  chain: string = "aptos_mainnet"
): Promise<Uint8Array> {
  const base64Challenge = Buffer.from(challengeBytes).toString("base64");

  const requestBody = JSON.stringify({
    vault_id: vaultId,
    signer_type: "api_signer",
    type: "aptos_message",
    details: {
      type: "aptos_serialized_raw_message",
      chain,
      serialized_message: base64Challenge,
    },
  });

  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
  const signature = await signWithPrivateKey(payload, fordefiConfig.privateKeyPem);

  const url = `https://api.fordefi.com${fordefiConfig.apiPathEndpoint}`;
  const createResp = await axios.post(url, requestBody, {
    headers: {
      Authorization: `Bearer ${fordefiConfig.accessToken}`,
      "x-signature": signature,
      "x-timestamp": timestamp,
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });

  if (createResp.status < 200 || createResp.status >= 300) {
    throw new Error(
      `Fordefi create signing request failed (${createResp.status}): ${JSON.stringify(createResp.data)}`
    );
  }

  const txId = createResp.data.id;
  console.log(`Fordefi signing request created: ${txId}`);

  // Poll for completion
  const signedTx = await pollForSignature(
    fordefiConfig.apiPathEndpoint,
    fordefiConfig.accessToken,
    txId
  );

  // Extract the raw signature bytes from the response
  const sigHex: string = signedTx.signatures?.[0]?.data
    ?? signedTx.signed_message?.signature
    ?? signedTx.signature;

  if (!sigHex) {
    throw new Error(
      `Could not extract signature from Fordefi response: ${JSON.stringify(signedTx)}`
    );
  }

  const clean = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
  return Uint8Array.from(Buffer.from(clean, "hex"));
}

async function pollForSignature(
  apiPath: string,
  accessToken: string,
  txId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<any> {
  const url = `https://api.fordefi.com${apiPath}/${txId}`;

  for (let i = 0; i < maxAttempts; i++) {
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(
        `Fordefi poll failed (${resp.status}): ${JSON.stringify(resp.data)}`
      );
    }

    const state = resp.data.state;
    if (state === "completed" || state === "signed" || state === "mined") {
      return resp.data;
    }
    if (state === "failed" || state === "aborted" || state === "rejected") {
      throw new Error(`Fordefi signing failed with state: ${state}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Fordefi signing timed out after ${maxAttempts} attempts`);
}
