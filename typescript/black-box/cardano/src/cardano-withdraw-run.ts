import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { runCardanoFlow } from './cardano-flow';
import { CARDANO_NETWORK, fordefiConfig } from './cardano-config';
import { getAccountInfo } from './cardano-serializer';
import { publicKeyToRewardAddress, publicKeyToStakeAddress } from './cardano-address-utils';

runCardanoFlow(async (builder) => {
    const publicKeyBuffer = Buffer.from(fordefiConfig.vaultPublicKey, 'base64');
    const stakeAddress = publicKeyToStakeAddress(publicKeyBuffer, CARDANO_NETWORK);
    console.log('Stake address:', stakeAddress);

    const account = await getAccountInfo(stakeAddress);
    if (!account?.active) {
        throw new Error(`Stake key ${stakeAddress} is not registered — run "npm run delegate" first.`);
    }

    // Cardano requires withdrawing the reward account's exact full balance.
    const withdrawable = BigInt(account.withdrawable_amount ?? '0');
    if (withdrawable === 0n) throw new Error('No rewards available to withdraw yet.');
    if (!account.drep_id) {
        console.warn(
            'Warning: no DRep delegation found for this stake key — post-Conway rules may reject the withdrawal. Run "npm run delegate" to set one.',
        );
    }
    console.log(`Withdrawing ${withdrawable} lovelace of rewards (paid out with the change output).`);

    const withdrawals = CSL.WithdrawalsBuilder.new();
    withdrawals.add(
        publicKeyToRewardAddress(publicKeyBuffer, CARDANO_NETWORK),
        CSL.BigNum.from_str(withdrawable.toString()),
    );
    builder.set_withdrawals_builder(withdrawals);
});
