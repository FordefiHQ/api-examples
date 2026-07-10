import axios from 'axios';
import { ApiPromise, WsProvider } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { signWithPrivateKey } from './signer';
import { createAndSignTx } from './process_tx';
import { FORDEFI_API_PATH, RPC_URL, fordefiConfig, network } from './polkadot-config';
import { publicKeyToPolkadotAddress } from './polkadot-address-utils';
import { buildPolkadotPayload, BuildCtx } from './polkadot-serializer';
import { fetchAndBroadcastPolkadotTransaction } from './broadcast-polkadot-transaction';

export async function runPolkadotFlow(
    configure: (ctx: BuildCtx) => SubmittableExtrinsic<'promise'> | Promise<SubmittableExtrinsic<'promise'>>,
) {
    let api: ApiPromise | undefined;
    try {
        if (!fordefiConfig.vaultPublicKey) throw new Error('VAULT_PUBLIC_KEY is required');

        api = await ApiPromise.create({ provider: new WsProvider(RPC_URL) });
        console.log(`Connected to ${(await api.rpc.system.chain()).toString()} via ${RPC_URL}`);

        const originAddress = publicKeyToPolkadotAddress(
            Buffer.from(fordefiConfig.vaultPublicKey, 'base64'),
            network.ss58Prefix,
        );
        console.log('Origin Polkadot address:', originAddress);

        const { payload, tx, signerPayload, signingBytes } = await buildPolkadotPayload(
            api,
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

        const result = await fetchAndBroadcastPolkadotTransaction(
            api,
            tx,
            signerPayload,
            signingBytes,
            originAddress,
            transactionId,
            fordefiConfig.accessToken,
        );

        console.log('\n=== SUCCESS ===');
        console.log('Extrinsic hash:', result.txHash);
        console.log(`Explorer: https://${network.subscanHost}/extrinsic/${result.txHash}`);
    } catch (error) {
        console.error('\n=== ERROR ===');
        if (axios.isAxiosError(error)) {
            console.error('Status:', error.response?.status);
            console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        } else {
            console.error(error);
        }
        process.exitCode = 1;
    } finally {
        // Without this the WsProvider keeps the Node process alive forever.
        await api?.disconnect();
    }
}
