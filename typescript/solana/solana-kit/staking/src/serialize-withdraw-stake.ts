import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';
import { Client } from './utils/solana-client-util';
import { getWithdrawInstruction } from '@solana-program/stake';

export async function createWithdrawStakeTx(
  fordefiConfig: FordefiSolanaConfig,
  solana_client: Client,
  stakeAccountAddress: string,
  amountLamports?: bigint // if not provided, withdraws entire balance
) {
  const staker = kit.address(fordefiConfig.originVaultAddress);
  const stakerSigner = kit.createNoopSigner(staker);
  const stakeAccount = kit.address(stakeAccountAddress);

  let withdrawAmount = amountLamports;
  if (!withdrawAmount) {
    const accountInfo = await solana_client.rpc
      .getAccountInfo(stakeAccount, { encoding: 'base64' })
      .send();
    if (!accountInfo.value) {
      throw new Error(`Stake account ${stakeAccountAddress} not found`);
    }
    withdrawAmount = accountInfo.value.lamports;
  }

  console.debug('Withdrawing from stake account:', stakeAccount);
  console.debug('Withdraw amount:', withdrawAmount, 'lamports');
  console.debug('Recipient:', staker);

  const ixes: kit.Instruction[] = [];
  ixes.push(
    getWithdrawInstruction({
      stake: stakeAccount,
      recipient: staker,
      stakeHistory: kit.address('SysvarStakeHistory1111111111111111111111111'),
      withdrawAuthority: stakerSigner,
      args: withdrawAmount,
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
