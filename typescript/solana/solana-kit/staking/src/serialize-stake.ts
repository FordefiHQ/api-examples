import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';
import { Client } from './utils/solana-client-util';
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

export async function createTx(fordefiConfig: FordefiSolanaConfig, solana_client: Client) {
  const staker = kit.address(fordefiConfig.originVaultAddress);
  const stakerSigner = kit.createNoopSigner(staker);
  const validatorVoteAccount = kit.address(fordefiConfig.validatorAddress);

  const amountToStakeLamports = BigInt(
    Math.floor(parseFloat(fordefiConfig.amountToStake) * 1e9)
  );

  const rentExemptLamports = await solana_client.rpc
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
      stakeHistory: kit.address('SysvarStakeHistory1111111111111111111111111'),
      unused: kit.address('StakeConfig11111111111111111111111111111111'),
      stakeAuthority: stakerSigner,
    })
  );

  const { value: latestBlockhash } = await solana_client.rpc
    .getLatestBlockhash()
    .send();

  const txMessage = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (message) => kit.setTransactionMessageFeePayer(staker, message),
    (message) =>
      kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
    (message) => kit.appendTransactionMessageInstructions(ixes, message)
  );

  const signedTx = await kit.partiallySignTransactionMessageWithSigners(txMessage);
  const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');

  const jsonBody = {
    vault_id: fordefiConfig.originVaultId,
    signer_type: 'api_signer',
    sign_mode: 'auto',
    type: 'solana_transaction',
    details: {
      type: 'solana_serialized_transaction_message',
      push_mode: 'auto',
      chain: 'solana_mainnet',
      data: base64EncodedData,
    },
  };

  return jsonBody;
}
