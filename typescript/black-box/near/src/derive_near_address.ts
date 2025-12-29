import { NEAR_NETWORK } from './near-config';
import dotenv from 'dotenv';

dotenv.config()

/**
 * Derives a NEAR implicit account address from an ED25519 public key.
 *
 * NEAR implicit accounts use the hex representation of the 32-byte ED25519 public key
 * as the account ID (64 hex characters).
 *
 * @see https://docs.near.org/integrations/implicit-accounts
 */
export function publicKeyToNearImplicitAddress(publicKeyBytes: Buffer): string {
    if (publicKeyBytes.length !== 32) {
        throw new Error(`Expected 32-byte ED25519 public key, got ${publicKeyBytes.length} bytes`);
    }

    // NEAR implicit address is simply the hex encoding of the public key
    return publicKeyBytes.toString('hex').toLowerCase();
}

/**
 * Formats a NEAR public key in the standard ed25519:base58 format
 */
export async function publicKeyToNearFormat(publicKeyBytes: Buffer): Promise<string> {
    const bs58 = await import("bs58");

    if (publicKeyBytes.length !== 32) {
        throw new Error(`Expected 32-byte ED25519 public key, got ${publicKeyBytes.length} bytes`);
    }

    const base58Key = bs58.default.encode(publicKeyBytes);
    return `ed25519:${base58Key}`;
}


async function deriveNearAddress() {
    const publicKeyBuffer = Buffer.from(process.env.VAULT_PUBLIC_KEY!, 'base64');

    const implicitAddress = publicKeyToNearImplicitAddress(publicKeyBuffer);
    const nearPublicKey = await publicKeyToNearFormat(publicKeyBuffer);

    console.log('Your NEAR implicit account address:', implicitAddress);
    console.log('Your NEAR public key:', nearPublicKey);

    if (NEAR_NETWORK === 'mainnet') {
        console.log(`https://nearblocks.io/address/${implicitAddress}`);
    } else {
        console.log(`https://testnet.nearblocks.io/address/${implicitAddress}`);
    }
}

deriveNearAddress();
