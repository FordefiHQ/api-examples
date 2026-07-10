import { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { SignerPayload } from '@polkadot/types/interfaces';
import { u8aConcat } from '@polkadot/util';
import { ed25519Verify } from '@polkadot/util-crypto';
import { FORDEFI_API_PATH, fordefiConfig } from './polkadot-config';
import { get_tx } from './process_tx';

export async function fetchAndBroadcastPolkadotTransaction(
    api: ApiPromise,
    tx: SubmittableExtrinsic<'promise'>,
    signerPayload: SignerPayload,
    signingBytes: Uint8Array,
    originAddress: string,
    fordefiTxId: string,
    accessToken: string,
): Promise<{ txHash: string }> {
    const maxRetries = 10;
    const retryDelayMs = 2000;
    let response: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        response = await get_tx(FORDEFI_API_PATH, accessToken, fordefiTxId);
        console.log(`Fordefi state (${attempt}/${maxRetries}): ${response.state}`);
        if (response.state === 'completed') break;
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelayMs));
    }
    if (response?.state !== 'completed') {
        throw new Error(`Transaction not completed (state: ${response?.state})`);
    }

    const sigBase64 = response.signatures?.[0]?.data;
    if (!sigBase64) throw new Error('No signature returned by Fordefi');

    const sigBytes = Buffer.from(sigBase64, 'base64');
    if (sigBytes.length !== 64) {
        throw new Error(`Expected a 64-byte ed25519 signature, got ${sigBytes.length} bytes`);
    }

    // Free pre-broadcast check: the signature must verify over the exact payload bytes
    // with the vault pubkey, or the node would reject with BadProof. This catches any
    // transformation of the payload on Fordefi's side before we broadcast.
    const publicKeyBytes = Buffer.from(fordefiConfig.vaultPublicKey, 'base64');
    if (!ed25519Verify(signingBytes, sigBytes, publicKeyBytes)) {
        throw new Error(
            'Fordefi signature does not verify over the signing payload — aborting before broadcast.',
        );
    }

    // MultiSignature encoding: 0x00 type byte (Ed25519 variant) + 64-byte signature.
    const multiSignature = u8aConcat(new Uint8Array([0x00]), sigBytes);
    tx.addSignature(originAddress, multiSignature, signerPayload.toPayload());

    const txHash = await api.rpc.author.submitExtrinsic(tx);
    return { txHash: txHash.toHex() };
}
