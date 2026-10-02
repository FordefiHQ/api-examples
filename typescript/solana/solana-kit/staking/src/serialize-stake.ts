import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';
import { getCreateAccountWithSeedInstruction } from '@solana-program/system';
import { getInitializeInstruction, getDelegateStakeInstruction, STAKE_PROGRAM_ADDRESS } from '@solana-program/stake';

// Stake account size defined by Solana stake program:
// 4 (state discriminator) + 96 (Meta: rent exempt reserve + authorized + lockup) + 100 (Stake: delegation + credits)
const STAKE_ACCOUNT_SIZE = 200n;

async function deriveStakeAccountAddress(
  staker: kit.Address,
  seed: string
): Promise<kit.Address> {
  const stakeAccountAddress = await kit.createAddressWithSeed({
    baseAddress: staker,
    seed: seed,
    programAddress: STAKE_PROGRAM_ADDRESS,
  });
  return stakeAccountAddress;
}

// The vault signer is the Fordefi signer from @solana/keychain-fordefi: Kit asks it to sign
// when the message is signed, so it must be used everywhere the vault appears as a signer
export async function createTx(
  stakerSigner: kit.TransactionSigner,
  rpc: kit.Rpc<kit.GetLatestBlockhashApi & kit.GetMinimumBalanceForRentExemptionApi & kit.GetStakeMinimumDelegationApi>,
  fordefiConfig: FordefiSolanaConfig
) {
  const staker = stakerSigner.address;
  const validatorVoteAccount = kit.address(fordefiConfig.validatorAddress);

  const amountToStakeLamports = BigInt(
    Math.floor(parseFloat(fordefiConfig.amountToStake) * 1e9)
  );

  // The stake program rejects delegations below the network minimum (1 SOL on mainnet), so check before
  // asking Fordefi to sign a transaction that cannot succeed
  const { value: minimumDelegation } = await rpc.getStakeMinimumDelegation().send();
  if (amountToStakeLamports < minimumDelegation) {
    throw new Error(
      `amountToStake is ${fordefiConfig.amountToStake} SOL, below the network's minimum stake delegation of ` +
      `${Number(minimumDelegation) / 1e9} SOL - raise amountToStake in config.ts`
    );
  }

  const rentExemptLamports = await rpc
    .getMinimumBalanceForRentExemption(STAKE_ACCOUNT_SIZE)
    .send();

  const totalLamports = amountToStakeLamports + rentExemptLamports;

  // generate a unique seed for the stake account (using timestamp)
  const seed = `stake:${Date.now()}`;
  const stakeAccount = await deriveStakeAccountAddress(staker, seed);
  console.debug('Stake account address:', stakeAccount);
  console.debug('Amount to stake:', amountToStakeLamports, 'lamports');
  console.debug('Validator vote account:', validatorVoteAccount);

  const ixes: kit.Instruction[] = [];
  ixes.push(
    getCreateAccountWithSeedInstruction({
      payer: stakerSigner,
      newAccount: stakeAccount,
      baseAccount: stakerSigner,
      base: staker,
      seed,
      amount: totalLamports,
      space: STAKE_ACCOUNT_SIZE,
      programAddress: STAKE_PROGRAM_ADDRESS,
    })
  );
  ixes.push(
    getInitializeInstruction({
      stake: stakeAccount,
      arg0: { staker, withdrawer: staker },
      arg1: {
        unixTimestamp: 0n,
        epoch: 0n,
        custodian: staker, // No custodian lockup
      },
    })
  );
  ixes.push(
    getDelegateStakeInstruction({
      stake: stakeAccount,
      vote: validatorVoteAccount,
      stakeAuthority: stakerSigner,
    })
  );

  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash()
    .send();

  return kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (message) => kit.setTransactionMessageFeePayerSigner(stakerSigner, message),
    (message) => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
    (message) => kit.appendTransactionMessageInstructions(ixes, message)
  );
}
