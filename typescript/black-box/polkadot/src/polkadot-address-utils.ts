import { encodeAddress } from '@polkadot/util-crypto';

// On Polkadot the account ID IS the raw ed25519 public key (no hashing, unlike Cardano's
// blake2b-224 key hash). SS58 = base58(prefix ++ pubkey ++ blake2b-512("SS58PRE" ++ data)[0..2]).
export function publicKeyToPolkadotAddress(publicKeyBytes: Buffer, ss58Prefix: number): string {
    if (publicKeyBytes.length !== 32) {
        throw new Error(`Expected a 32-byte ed25519 public key, got ${publicKeyBytes.length} bytes`);
    }
    return encodeAddress(publicKeyBytes, ss58Prefix);
}
