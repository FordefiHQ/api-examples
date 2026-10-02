import * as kit from '@solana/kit';
import { getWithdrawInstruction } from '@solana-program/stake';

export async function createWithdrawStakeTx(
  stakerSigner: kit.TransactionSigner,
  rpc: kit.Rpc<kit.GetLatestBlockhashApi & kit.GetAccountInfoApi>,
  stakeAccountAddress: string,
  amountLamports?: bigint // if not provided, withdraws entire balance
) {
  const staker = stakerSigner.address;
  const stakeAccount = kit.address(stakeAccountAddress);

  let withdrawAmount = amountLamports;
  if (!withdrawAmount) {
    const accountInfo = await rpc
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
      withdrawAuthority: stakerSigner,
      args: withdrawAmount,
    })
  );

  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash()
    .send();

  return kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (message) => kit.setTransactionMessageFeePayerSigner(stakerSigner, message),
    (message) =>
      kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
    (message) => kit.appendTransactionMessageInstructions(ixes, message)
  );
}
