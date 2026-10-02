import * as kit from '@solana/kit';
import { getDeactivateInstruction } from '@solana-program/stake';

export async function createUnstakeTx(
  stakerSigner: kit.TransactionSigner,
  rpc: kit.Rpc<kit.GetLatestBlockhashApi>,
  stakeAccountAddress: string
) {
  const staker = stakerSigner.address;
  const stakeAccount = kit.address(stakeAccountAddress);

  console.debug('Deactivating stake account:', stakeAccount);
  console.debug('Stake authority:', staker);

  const ixes: kit.Instruction[] = [];
  ixes.push(
    getDeactivateInstruction({
      stake: stakeAccount,
      stakeAuthority: stakerSigner,
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
