import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';
import { Client } from './utils/solana-client-util';
import { getDeactivateInstruction } from '@solana-program/stake';

export async function createUnstakeTx(
  fordefiConfig: FordefiSolanaConfig,
  solana_client: Client,
  stakeAccountAddress: string
) {
  const staker = kit.address(fordefiConfig.originVaultAddress);
  const stakerSigner = kit.createNoopSigner(staker);
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
