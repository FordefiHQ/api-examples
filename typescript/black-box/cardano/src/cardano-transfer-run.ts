import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { runCardanoFlow } from './cardano-flow';
import { CARDANO_NETWORK, transferConfig } from './cardano-config';
import { assertAboveMinAda } from './cardano-serializer';

runCardanoFlow((builder, ctx) => {
    const { destinationAddress, amountLovelace } = transferConfig;
    if (!destinationAddress) throw new Error('DESTINATION_ADDRESS is required');
    const expectedPrefix = CARDANO_NETWORK === 'mainnet' ? 'addr1' : 'addr_test1';
    if (!destinationAddress.startsWith(expectedPrefix)) {
        throw new Error(`Destination address must start with "${expectedPrefix}" on ${CARDANO_NETWORK}`);
    }

    const output = CSL.TransactionOutput.new(
        CSL.Address.from_bech32(destinationAddress),
        CSL.Value.new(CSL.BigNum.from_str(amountLovelace.toString())),
    );
    assertAboveMinAda(output, ctx.protocolParams);
    builder.add_output(output);
});
