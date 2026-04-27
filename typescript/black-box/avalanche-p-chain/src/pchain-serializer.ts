import crypto from 'crypto';
import { PCHAIN_RPC_URL } from './pchain-config';

let avalanche: any;
async function getAvalanche() {
    if (!avalanche) avalanche = await import('@avalabs/avalanchejs');
    return avalanche;
}

export type BuildCtx = {
    avalanche: any;
    context: any;
    utxos: any;
    feeState: any;
    fromAddressesBytes: Uint8Array[];
};

export async function buildPChainPayload(
    originAddress: string,
    vaultId: string,
    buildTx: (ctx: BuildCtx) => any,
) {
    const av = await getAvalanche();
    const pvmApi = new av.pvm.PVMApi(PCHAIN_RPC_URL);

    const context = await av.Context.getContextFromURI(PCHAIN_RPC_URL);
    const fromAddressesBytes = [av.utils.bech32ToBytes(originAddress)];
    const { utxos } = await pvmApi.getUTXOs({ addresses: [originAddress] });
    if (utxos.length === 0) {
        throw new Error(`No UTXOs found for ${originAddress}. Ensure the address has AVAX balance.`);
    }
    const feeState = await pvmApi.getFeeState();

    const unsignedTx = buildTx({ avalanche: av, context, utxos, feeState, fromAddressesBytes });

    const txHash = crypto.createHash('sha256').update(unsignedTx.toBytes()).digest();

    const payload = {
        vault_id: vaultId,
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: 'black_box_signature',
        details: {
            format: 'hash_binary',
            hash_binary: txHash.toString('base64'),
        },
    };

    return { payload, unsignedTx };
}
