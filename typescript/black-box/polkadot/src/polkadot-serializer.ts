import { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { SignerPayload } from '@polkadot/types/interfaces';
import { hexToU8a } from '@polkadot/util';
import { blake2AsU8a } from '@polkadot/util-crypto';
import { polkadotConfig } from './polkadot-config';

export type BuildCtx = { api: ApiPromise };

// Guard against burning funds: a transfer below the existential deposit to a fresh
// account is rejected outright by transferKeepAlive, but the check gives a clear error.
export async function assertSafeAmount(
    api: ApiPromise,
    destinationAddress: string,
    amountPlanck: bigint,
): Promise<void> {
    const existentialDeposit = (api.consts.balances!.existentialDeposit as any).toBigInt();
    const account: any = await api.query.system!.account!(destinationAddress);
    if (account.data.free.toBigInt() === 0n && amountPlanck < existentialDeposit) {
        throw new Error(
            `Destination is a new account and ${amountPlanck} planck is below the existential deposit of ${existentialDeposit} planck — the transfer would fail.`,
        );
    }
}

// Shared pipeline: let the caller build the extrinsic, then assemble the signer payload
// from live chain state and package the exact signing bytes as a Fordefi
// black_box_signature payload.
export async function buildPolkadotPayload(
    api: ApiPromise,
    originAddress: string,
    vaultId: string,
    configure: (ctx: BuildCtx) => SubmittableExtrinsic<'promise'> | Promise<SubmittableExtrinsic<'promise'>>,
) {
    const tx = await configure({ api });

    const signedBlock = await api.rpc.chain.getBlock();
    const blockHash = signedBlock.block.header.hash;
    const blockNumber = signedBlock.block.header.number.toNumber();
    const nonce = await api.rpc.system.accountNextIndex(originAddress);
    const era = api.registry.createType('ExtrinsicEra', {
        current: blockNumber,
        period: polkadotConfig.eraPeriodBlocks,
    });

    // Built from the live registry so the chain's signed extensions (ChargeAssetTxPayment,
    // CheckMetadataHash, ...) are picked up automatically; omitted mode/metadataHash/assetId
    // default to Disabled/None — identical to what signAsync produces.
    const signerPayload = api.registry.createType('SignerPayload', {
        address: originAddress,
        blockHash,
        blockNumber,
        era,
        genesisHash: api.genesisHash,
        method: tx.method.toHex(),
        nonce,
        runtimeVersion: api.runtimeVersion,
        signedExtensions: api.registry.signedExtensions,
        tip: 0,
        version: tx.version,
    }) as unknown as SignerPayload;

    // The exact bytes an on-chain verifier checks. Polkadot convention: payloads over
    // 256 bytes are blake2b-256 hashed before signing; a plain transfer (~120 bytes)
    // is signed raw. Unlike the sibling examples, hash_binary here carries the full
    // payload, not a 32-byte hash — Fordefi signs whatever bytes it is given.
    const rawBytes = hexToU8a(signerPayload.toRaw().data);
    const signingBytes = rawBytes.length > 256 ? blake2AsU8a(rawBytes) : rawBytes;

    const payload = {
        vault_id: vaultId,
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: 'black_box_signature',
        details: {
            format: 'hash_binary',
            hash_binary: Buffer.from(signingBytes).toString('base64'),
        },
    };

    return { payload, tx, signerPayload, signingBytes };
}
