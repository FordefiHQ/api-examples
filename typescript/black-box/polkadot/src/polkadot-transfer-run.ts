import { decodeAddress } from '@polkadot/util-crypto';
import { runPolkadotFlow } from './polkadot-flow';
import { transferConfig } from './polkadot-config';
import { assertSafeAmount } from './polkadot-serializer';

runPolkadotFlow(async ({ api }) => {
    const { destinationAddress, amountPlanck } = transferConfig;
    if (!destinationAddress) throw new Error('DESTINATION_ADDRESS is required');
    decodeAddress(destinationAddress); // throws on an invalid SS58 address/checksum

    await assertSafeAmount(api, destinationAddress, amountPlanck);

    return api.tx.balances!.transferKeepAlive!(destinationAddress, amountPlanck);
});
