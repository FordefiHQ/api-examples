import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { runCardanoFlow } from './cardano-flow';
import { CARDANO_NETWORK, fordefiConfig, stakingConfig } from './cardano-config';
import { getAccountInfo } from './cardano-serializer';
import { publicKeyToCredential, publicKeyToStakeAddress } from './cardano-address-utils';

runCardanoFlow(async (builder, ctx) => {
    if (!stakingConfig.poolId) throw new Error('POOL_ID is required (bech32 pool1...)');

    const publicKeyBuffer = Buffer.from(fordefiConfig.vaultPublicKey, 'base64');
    const stakeCredential = publicKeyToCredential(publicKeyBuffer);
    const stakeAddress = publicKeyToStakeAddress(publicKeyBuffer, CARDANO_NETWORK);
    console.log('Stake address:', stakeAddress);

    const account = await getAccountInfo(stakeAddress);
    const certs = CSL.CertificatesBuilder.new();

    if (!account?.active) {
        const depositAda = Number(ctx.protocolParams.key_deposit) / 1e6;
        console.log(`Stake key not registered yet — adding registration certificate (${depositAda} ADA deposit).`);
        certs.add(CSL.Certificate.new_stake_registration(CSL.StakeRegistration.new(stakeCredential)));
    }

    console.log(`Delegating to pool ${stakingConfig.poolId}`);
    certs.add(
        CSL.Certificate.new_stake_delegation(
            CSL.StakeDelegation.new(stakeCredential, CSL.Ed25519KeyHash.from_bech32(stakingConfig.poolId)),
        ),
    );

    // Post-Conway, withdrawing rewards requires the stake key to have delegated voting
    // power to a DRep; "always abstain" is the minimal choice.
    certs.add(
        CSL.Certificate.new_vote_delegation(
            CSL.VoteDelegation.new(stakeCredential, CSL.DRep.new_always_abstain()),
        ),
    );

    builder.set_certs_builder(certs);
});
