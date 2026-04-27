import axios from 'axios';
import { signWithPrivateKey } from './signer';
import { createAndSignTx } from './process_tx';
import { fordefiConfig, FORDEFI_API_PATH } from './pchain-config';
import { publicKeyToPChainAddressCompat } from './pchain-address-utils';
import { buildPChainPayload, BuildCtx } from './pchain-serializer';
import { fetchAndBroadcastPChainTransaction } from './broadcast-pchain-transaction';

export async function runPChainFlow(buildTx: (ctx: BuildCtx) => any) {
    try {
        if (!fordefiConfig.vaultPublicKey) {
            throw new Error('VAULT_PUBLIC_KEY is required');
        }

        const originAddress = await publicKeyToPChainAddressCompat(
            Buffer.from(fordefiConfig.vaultPublicKey, 'base64'),
        );
        console.log('Origin P-Chain address:', originAddress);

        const { payload, unsignedTx } = await buildPChainPayload(
            originAddress,
            fordefiConfig.vaultId,
            buildTx,
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

        const result = await fetchAndBroadcastPChainTransaction(
            unsignedTx,
            transactionId,
            fordefiConfig.accessToken,
        );

        console.log('\n=== SUCCESS ===');
        console.log('Tx ID:', result.txId, '| Status:', result.status);
        console.log(`Explorer: https://subnets.avax.network/p-chain/tx/${result.txId}`);
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
