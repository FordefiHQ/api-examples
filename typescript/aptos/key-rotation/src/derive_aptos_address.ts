import { createHash } from "crypto";

// 1) Your Fordefi Ed25519 public key (base64, 32 bytes once decoded).
const pubkeyBase64 = '/xgXa+w1hAjdNWGb6cjeLrDGGvvAp0NdiRJNNBf3ZHM=';
const cleanB64 = pubkeyBase64.replace(/^[\'"\s]+|[\'"\s]+$/g, "");

// 2) Decode base64 -> bytes and sanity check (32 bytes for Ed25519).
const pubkeyBytes = Buffer.from(cleanB64, "base64");
if (pubkeyBytes.length !== 32) {
  throw new Error(`Expected 32-byte Ed25519 key, got ${pubkeyBytes.length}`);
}

// 3) Aptos uses Ed25519 single-signature scheme
// Address = SHA3-256(pubkey_bytes || 0x00)
// Note: 0x00 is the single signature scheme identifier
const singleSigScheme = Buffer.from([0x00]);
const sha3_256 = createHash("sha3-256")
  .update(pubkeyBytes)
  .update(singleSigScheme)
  .digest();

// 4) Aptos address is the full 32-byte hash, represented as hex with 0x prefix
const address = "0x" + sha3_256.toString("hex");

console.log("Aptos address:", address);