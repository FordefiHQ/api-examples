import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';

// The black-box vault holds a single raw ed25519 key. We reuse its key hash as BOTH the
// payment and the stake credential (Cardano allows this), so one Fordefi signature
// witnesses spending, certificates, and reward withdrawals alike.

export function publicKeyToCredential(publicKeyBytes: Buffer): CSL.Credential {
    if (publicKeyBytes.length !== 32) {
        throw new Error(`Expected a 32-byte ed25519 public key, got ${publicKeyBytes.length} bytes`);
    }
    const keyHash = CSL.PublicKey.from_bytes(publicKeyBytes).hash(); // blake2b-224
    return CSL.Credential.from_keyhash(keyHash);
}

function networkIdFor(network: string): number {
    return network === 'mainnet'
        ? CSL.NetworkInfo.mainnet().network_id()
        : CSL.NetworkInfo.testnet_preprod().network_id();
}

// Base address (addr1q...): payment + stake credential. This is the address all flows
// use — ADA held here counts toward stake delegation.
export function publicKeyToCardanoAddress(publicKeyBytes: Buffer, network: string): string {
    const credential = publicKeyToCredential(publicKeyBytes);
    return CSL.BaseAddress.new(networkIdFor(network), credential, credential)
        .to_address()
        .to_bech32();
}

// Enterprise address (addr1v...): payment credential only, cannot stake. Same spending
// key as the base address, but a distinct address holding distinct UTxOs.
export function publicKeyToEnterpriseAddress(publicKeyBytes: Buffer, network: string): string {
    const credential = publicKeyToCredential(publicKeyBytes);
    return CSL.EnterpriseAddress.new(networkIdFor(network), credential).to_address().to_bech32();
}

export function publicKeyToRewardAddress(publicKeyBytes: Buffer, network: string): CSL.RewardAddress {
    const credential = publicKeyToCredential(publicKeyBytes);
    return CSL.RewardAddress.new(networkIdFor(network), credential);
}

// Stake address (stake1...): identifies the reward account on explorers and Blockfrost.
export function publicKeyToStakeAddress(publicKeyBytes: Buffer, network: string): string {
    return publicKeyToRewardAddress(publicKeyBytes, network).to_address().to_bech32();
}
