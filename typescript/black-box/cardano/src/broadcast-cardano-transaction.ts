import axios from 'axios';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { BLOCKFROST_BASE_URL, BLOCKFROST_PROJECT_ID, FORDEFI_API_PATH, fordefiConfig } from './cardano-config';
import { get_tx } from './process_tx';

export async function fetchAndBroadcastCardanoTransaction(
    fixedTx: CSL.FixedTransaction,
    fordefiTxId: string,
    accessToken: string,
): Promise<{ txId: string }> {
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

    // One vkey witness is enough: every input is locked by the same key hash.
    const vkeyWitness = CSL.Vkeywitness.new(
        CSL.Vkey.new(CSL.PublicKey.from_bytes(Buffer.from(fordefiConfig.vaultPublicKey, 'base64'))),
        CSL.Ed25519Signature.from_bytes(sigBytes),
    );
    fixedTx.add_vkey_witness(vkeyWitness);

    const resp = await axios.post(`${BLOCKFROST_BASE_URL}/tx/submit`, Buffer.from(fixedTx.to_bytes()), {
        headers: { project_id: BLOCKFROST_PROJECT_ID, 'Content-Type': 'application/cbor' },
        validateStatus: () => true,
    });
    if (resp.status !== 200) {
        throw new Error(`Blockfrost submit ${resp.status}: ${JSON.stringify(resp.data)}`);
    }

    return { txId: resp.data }; // Blockfrost returns the tx hash as a JSON string
}
