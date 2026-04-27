import { runPChainFlow } from './pchain-flow';
import { stakingConfig } from './pchain-config';

runPChainFlow(({ avalanche, context, utxos, feeState, fromAddressesBytes }) => {
    const rewardAddresses = stakingConfig.rewardAddress
        ? [avalanche.utils.bech32ToBytes(stakingConfig.rewardAddress)]
        : fromAddressesBytes;

    return avalanche.pvm.newAddPermissionlessDelegatorTx(
        {
            end: stakingConfig.endTime,
            feeState,
            fromAddressesBytes,
            nodeId: stakingConfig.nodeId,
            rewardAddresses,
            start: stakingConfig.startTime,
            subnetId: context.pBlockchainID,
            utxos,
            weight: stakingConfig.stakeAmount,
        },
        context,
    );
});
