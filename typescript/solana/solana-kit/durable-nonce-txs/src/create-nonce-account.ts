import { fordefiConfig, nonceConfig } from './config';
import { fordefiGet, fordefiPost, pollUntilTerminal } from '../utils/fordefi-rest';

/**
 * Creates one or more Solana durable nonce accounts for a Fordefi vault.
 *
 * Submits Fordefi's native `solana_nonce_account_creation` transaction. Fordefi
 * derives the new nonce account address, funds it with the rent-exempt minimum,
 * sets the vault as the nonce authority, then signs and broadcasts it
 * (push_mode auto). When the transaction completes, the accounts appear in the
 * vault's nonce pool (GET /api/v1/vaults/{id}/solana-nonce-accounts), and
 * `npm run transfer` can use them.
 */
async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }
  if (!fordefiConfig.vaultId || !fordefiConfig.vaultAddress) {
    console.error('Error: FORDEFI_VAULT_ID and FORDEFI_VAULT_ADDRESS environment variables are not set');
    return;
  }

  const requestBody = {
    type: 'solana_transaction',
    vault_id: fordefiConfig.vaultId,
    signer_type: 'api_signer',
    sign_mode: 'auto',
    details: {
      type: 'solana_nonce_account_creation',
      chain: fordefiConfig.chain,
      // The vault becomes the nonce authority, so transactions the vault
      // signs can spend the stored nonce.
      authority: fordefiConfig.vaultAddress,
      count: nonceConfig.count,
      push_mode: 'auto',
    },
  };

  console.log(`Creating ${nonceConfig.count} durable nonce account(s) for vault ${fordefiConfig.vaultId} on ${fordefiConfig.chain}`);
  console.log('Request:', JSON.stringify(requestBody, null, 2));

  const created = await fordefiPost(fordefiConfig, '/api/v1/transactions', requestBody);
  console.log(`Transaction submitted to Fordefi (id: ${created.id})`);

  await pollUntilTerminal(fordefiConfig, created.id);
  console.log('Nonce account creation completed');

  const pool = await fordefiGet(
    fordefiConfig,
    `/api/v1/vaults/${fordefiConfig.vaultId}/solana-nonce-accounts?chain=${fordefiConfig.chain}`,
  );
  const accounts: Array<{ address?: string; state?: string }> = pool.nonce_accounts ?? [];
  if (accounts.length === 0) {
    throw new Error('Fordefi returned an empty nonce pool - the creation transaction may not have been indexed yet');
  }
  console.log(`Vault nonce pool (${accounts.length} account(s)):`);
  for (const account of accounts) {
    console.log(`  ${account.address} [${account.state}]`);
  }
  console.log(`\nReady - run \`npm run transfer\` to spend a nonce from ${accounts[0]?.address}`);
}

main().catch(error => {
  console.error(`Failed to create the nonce account: ${error.message}`);
  // A SignerError from the Fordefi signer has the API response body in .context
  if (error.context) {
    console.error('Error context:', JSON.stringify(error.context, null, 2));
  }
  process.exitCode = 1;
});
