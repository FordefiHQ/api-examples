import * as kit from '@solana/kit';
import { fordefiConfig } from './config';
import { createTx } from './serialize-stake';
import { createUnstakeTx } from './serialize-unstake';
import { createClient } from './utils/solana-client-util';
import { createWithdrawStakeTx } from './serialize-withdraw-stake';

export async function main(): Promise<void> {
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

  const solana_client = createClient();

  // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
  const { createFordefiSigner } = await import('@solana/keychain-fordefi');

  try {
    // Auto push mode: Fordefi signs the transaction and broadcasts it to the network
    const vaultSigner = await createFordefiSigner({
      accessToken: fordefiConfig.accessToken,
      vaultId: fordefiConfig.originVaultId,
      publicKey: fordefiConfig.originVaultAddress,
      privateKeyPem: fordefiConfig.privateKeyPem,
      chain: fordefiConfig.chain,
    });

    let txMessage;
    switch (fordefiConfig.action) {
      case 'stake':
        console.log('Creating stake transaction...');
        txMessage = await createTx(vaultSigner, solana_client.rpc, fordefiConfig);
        break;
      case 'unstake':
        console.log('Creating unstake (deactivate) transaction...');
        txMessage = await createUnstakeTx(vaultSigner, solana_client.rpc, fordefiConfig.stakeAccountAddress);
        break;
      case 'withdraw':
        console.log('Creating withdraw stake transaction...');
        txMessage = await createWithdrawStakeTx(vaultSigner, solana_client.rpc, fordefiConfig.stakeAccountAddress);
        break;
      default:
        console.error(`Error: Invalid action "${fordefiConfig.action}". Must be one of: stake, unstake, withdraw`);
        return;
    }

    const signature = kit.getBase58Decoder().decode(
      await kit.signAndSendTransactionMessageWithSigners(txMessage)
    );

    const actionMessages: Record<string, string> = {
      stake: 'Staking transaction signed and submitted to network',
      unstake: 'Unstake (deactivate) transaction signed and submitted to network',
      withdraw: 'Withdraw stake transaction signed and submitted to network',
    };
    console.log(`${actionMessages[fordefiConfig.action]} 📡`);
    console.log(`Signature: ${signature}`);

    if (fordefiConfig.action === 'unstake') {
      console.log('Note: After deactivation, you must wait ~2 epochs before withdrawing.');
    }

    const cluster = fordefiConfig.chain === 'solana_devnet' ? '?cluster=devnet' : '';
    console.log(`Link to explorer: \nhttps://solscan.io/tx/${signature}${cluster}`);
  } catch (error: any) {
    console.error(`Failed to sign the transaction: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}
