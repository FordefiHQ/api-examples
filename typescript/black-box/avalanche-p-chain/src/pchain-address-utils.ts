import { createHash } from "crypto";

export async function publicKeyToPChainAddressCompat(publicKeyBytes: Buffer): Promise<string> {
    const { bech32 } = await import("bech32");
    
    if (publicKeyBytes.length !== 33) {
        throw new Error(`Expected 33-byte compressed public key, got ${publicKeyBytes.length}`);
    }

    // Hash with SHA256, then RIPEMD160
    const sha256Hash = createHash("sha256").update(publicKeyBytes).digest();
    const ripemd160Hash = createHash("ripemd160").update(sha256Hash).digest();
    
    // Convert to 5-bit words for bech32 encoding
    const words = bech32.toWords(ripemd160Hash);
    
    // Encode with bech32
    const bech32Address = bech32.encode("avax", words);
    
    // Add P-Chain prefix (uppercase P for Avalanche standard)
    return `P-${bech32Address}`;
}