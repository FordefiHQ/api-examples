import { fordefiConfig } from './config';
import { createTx } from './serialize-stake';
import { signWithApiUserPrivateKey } from './signer';
import { createUnstakeTx } from './serialize-unstake';
import { createClient } from './utils/solana-client-util';
import { createWithdrawStakeTx } from './serialize-withdraw-stake';
import { createAndSignTx, pollForSignedTransaction, get_tx } from './utils/process_tx';

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  if (fordefiConfig.action === 'stake' && !fordefiConfig.validatorAddress) {
    console.error('Error: VALIDATOR_ADDRESS environment variable is not set (required for stake action)');
    return;
  }
  if ((fordefiConfig.action === 'unstake' || fordefiConfig.action === 'withdraw') && !fordefiConfig.stakeAccountAddress) {
    console.error('Error: STAKE_ACCOUNT_ADDRESS environment variable is not set (required for unstake/withdraw actions)');
    return;
  }

  const solana_client = await createClient();

  let jsonBody;
  switch (fordefiConfig.action) {
    case 'stake':
      console.log('Creating stake transaction...');
      jsonBody = await createTx(fordefiConfig, solana_client);
      break;
    case 'unstake':
      console.log('Creating unstake (deactivate) transaction...');
      jsonBody = await createUnstakeTx(fordefiConfig, solana_client, fordefiConfig.stakeAccountAddress);
      break;
    case 'withdraw':
      console.log('Creating withdraw stake transaction...');
      jsonBody = await createWithdrawStakeTx(fordefiConfig, solana_client, fordefiConfig.stakeAccountAddress);
      break;
    default:
      console.error(`Error: Invalid action "${fordefiConfig.action}". Must be one of: stake, unstake, withdraw`);
      return;
  }

  const requestBody = JSON.stringify(jsonBody);
  const timestamp = new Date().getTime();
  const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;

  try {
    // Sign payload with API User private key
    const signature = await signWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);

    // Send signed payload to Fordefi for MPC signature
    const response = await createAndSignTx(fordefiConfig, signature, timestamp, requestBody);
    const data = response.data;

    const actionMessages: Record<string, string> = {
      stake: 'Staking transaction signed and submitted to network',
      unstake: 'Unstake (deactivate) transaction signed and submitted to network',
      withdraw: 'Withdraw stake transaction signed and submitted to network',
    };
    console.log(`${actionMessages[fordefiConfig.action]} 📡`);
    console.log(`Transaction ID: ${data.id}`);

    if (fordefiConfig.action === 'unstake') {
      console.log('Note: After deactivation, you must wait ~2 epochs before withdrawing.');
    }

    const rawTxResult = await pollForSignedTransaction(data.id, fordefiConfig.accessToken);
    console.log(`Raw transaction: \n${rawTxResult}`);
    const txData = await get_tx(data.id, fordefiConfig.accessToken);
    console.log(`Link to explorer: \n${txData.explorer_url}`);
  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
