import { PCHAIN_RPC_URL, FORDEFI_API_PATH } from './pchain-config';
import { get_tx } from './process_tx';

let avalanche: any;
async function getAvalanche() {
    if (!avalanche) avalanche = await import('@avalabs/avalanchejs');
    return avalanche;
}

export async function fetchAndBroadcastPChainTransaction(
    unsignedTx: any,
    fordefiTxId: string,
    accessToken: string,
) {
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

    const av = await getAvalanche();
    // Fordefi returns 65-byte [r|s|v]; avalanchejs wraps it as a single Credential
    // covering the whole tx (sufficient for single-key inputs).
    const sigBytes = new Uint8Array(Buffer.from(sigBase64, 'base64'));
    const signedTx = unsignedTx.getSignedTx();
    signedTx.credentials = [new av.Credential([new av.Signature(sigBytes)])];

    const pvmApi = new av.pvm.PVMApi(PCHAIN_RPC_URL);
    const txIdRaw = await pvmApi.issueSignedTx(signedTx);
    // pvmApi.issueSignedTx may return a string or { txID }
    const txId = typeof txIdRaw === 'string' ? txIdRaw : txIdRaw.txID;
    const status = await pvmApi.getTxStatus({ txID: txId });

    return { txId, status };
}
