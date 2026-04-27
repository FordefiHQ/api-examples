import { createHash } from 'crypto';
import { bech32 } from 'bech32';

export async function publicKeyToPChainAddressCompat(publicKeyBytes: Buffer): Promise<string> {
    if (publicKeyBytes.length !== 33) {
        throw new Error(`Expected 33-byte compressed public key, got ${publicKeyBytes.length}`);
    }
    const sha256Hash = createHash('sha256').update(publicKeyBytes).digest();
    const ripemd160Hash = createHash('ripemd160').update(sha256Hash).digest();
    return `P-${bech32.encode('avax', bech32.toWords(ripemd160Hash))}`;
}
