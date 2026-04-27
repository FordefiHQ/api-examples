import { runPChainFlow } from './pchain-flow';
import { transferConfig } from './pchain-config';

runPChainFlow(({ avalanche, context, utxos, feeState, fromAddressesBytes }) => {
    const toAddress = avalanche.utils.bech32ToBytes(transferConfig.destinationAddress);
    const amount = BigInt(Math.round(transferConfig.amountAvax * 1e9));
    const outputs = [
        avalanche.TransferableOutput.fromNative(context.avaxAssetID, amount, [toAddress]),
    ];
    return avalanche.pvm.newBaseTx({ feeState, fromAddressesBytes, outputs, utxos }, context);
});
