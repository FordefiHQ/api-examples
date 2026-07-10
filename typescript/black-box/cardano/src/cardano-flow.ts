import axios from 'axios';
import { signWithPrivateKey } from './signer';
import { createAndSignTx } from './process_tx';
import { BLOCKFROST_PROJECT_ID, CARDANO_NETWORK, FORDEFI_API_PATH, fordefiConfig } from './cardano-config';
import { publicKeyToCardanoAddress } from './cardano-address-utils';
import { buildCardanoPayload, BuildCtx } from './cardano-serializer';
import { fetchAndBroadcastCardanoTransaction } from './broadcast-cardano-transaction';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';

export async function runCardanoFlow(
    configure: (builder: CSL.TransactionBuilder, ctx: BuildCtx) => void | Promise<void>,
) {
    try {
        if (!fordefiConfig.vaultPublicKey) throw new Error('VAULT_PUBLIC_KEY is required');
        if (!BLOCKFROST_PROJECT_ID) throw new Error('BLOCKFROST_PROJECT_ID is required');

        const originAddress = publicKeyToCardanoAddress(
            Buffer.from(fordefiConfig.vaultPublicKey, 'base64'),
            CARDANO_NETWORK,
        );
        console.log('Origin Cardano address:', originAddress);

        const { payload, fixedTx } = await buildCardanoPayload(
            originAddress,
            fordefiConfig.vaultId,
            configure,
        );

        const requestBody = JSON.stringify(payload);
        const timestamp = Date.now();
        const signature = await signWithPrivateKey(
            `${FORDEFI_API_PATH}|${timestamp}|${requestBody}`,
            fordefiConfig.privateKeyPem,
        );

        const fordefiResponse = await createAndSignTx(
            FORDEFI_API_PATH,
            fordefiConfig.accessToken,
            signature,
            timestamp,
            requestBody,
        );
        const transactionId = fordefiResponse.data.id;
        console.log('Fordefi transaction ID:', transactionId);

        const result = await fetchAndBroadcastCardanoTransaction(
            fixedTx,
            transactionId,
            fordefiConfig.accessToken,
        );

        const explorerHost = CARDANO_NETWORK === 'mainnet' ? 'cardanoscan.io' : 'preprod.cardanoscan.io';
        console.log('\n=== SUCCESS ===');
        console.log('Tx ID:', result.txId);
        console.log(`Explorer: https://${explorerHost}/transaction/${result.txId}`);
    } catch (error) {
        console.error('\n=== ERROR ===');
        if (axios.isAxiosError(error)) {
            console.error('Status:', error.response?.status);
            console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}
