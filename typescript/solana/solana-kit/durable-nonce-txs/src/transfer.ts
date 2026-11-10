import { getTransactionDecoder, getSignatureFromTransaction } from '@solana/kit';
import { fordefiConfig, transferConfig } from './config';
import { fordefiGet, fordefiPost, pollUntilTerminal } from '../utils/fordefi-rest';
import { fetchNonceAccount } from '../utils/nonce-account';
import { createClient } from '../utils/solana-client-util';

/**
 * Sends a simple SOL transfer whose lifetime is the vault's durable nonce
 * instead of a recent blockhash, so the transaction survives arbitrarily long
 * approval and signing.
 *
 * Fordefi manages the nonce account created by `npm run create-nonce-account`:
 * whenever the vault has a free nonce account, built transaction types (like
 * this `solana_transfer`) are automatically built on it - the stored nonce goes
 * into the blockhash field and an AdvanceNonceAccount instruction is prepended.
 * Raw submissions (`solana_serialized_transaction_message`) that reference the
 * managed nonce account are rejected by the API, so the transfer must go
 * through this built type. When no nonce account is free, Fordefi falls back to
 * a regular recent-blockhash transaction.
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
  if (!transferConfig.destinationAddress) {
    console.error('Error: DESTINATION_ADDRESS environment variable is not set');
    return;
  }

  const requestBody = {
    type: 'solana_transaction',
    vault_id: fordefiConfig.vaultId,
    signer_type: 'api_signer',
    sign_mode: 'auto',
    details: {
      type: 'solana_transfer',
      chain: fordefiConfig.chain,
      to: { type: 'address', address: transferConfig.destinationAddress },
      value: { type: 'value', value: transferConfig.amountLamports.toString() },
      asset_identifier: { type: 'solana', details: { type: 'native', chain: fordefiConfig.chain } },
      // If the recipient account does not exist yet, the amount must be at
      // least the rent-exempt minimum (~0.0009 SOL) or creation is reverted.
      push_mode: 'auto',
    },
  };

  console.log(`Sending ${transferConfig.amountLamports} lamports to ${transferConfig.destinationAddress}`);
  const created = await fordefiPost(fordefiConfig, '/api/v1/transactions', requestBody);
  console.log(`Transaction submitted to Fordefi 📡 (id: ${created.id})`);

  const finalTx = await pollUntilTerminal(fordefiConfig, created.id);
  console.log(`Transfer ${finalTx.state} ✅`);

  if (finalTx.durable_nonce_account_address) {
    const nonceAccount = await fetchNonceAccount(createClient(), finalTx.durable_nonce_account_address);
    console.log(
      `Built on durable nonce account ${finalTx.durable_nonce_account_address} ` +
      `(stored nonce now: ${nonceAccount.durableNonce}) - no blockhash expiration ⏳`,
    );
  } else {
    console.log('Note: Fordefi built this transfer on a regular recent blockhash (no free nonce account found)');
  }

  const rawTx = finalTx.raw_transaction ?? finalTx.solana_transaction?.raw_transaction;
  if (rawTx) {
    const signature = getSignatureFromTransaction(getTransactionDecoder().decode(new Uint8Array(Buffer.from(rawTx, 'base64'))));
    console.log(`On ${fordefiConfig.chain} 📤 Signature: ${signature}`);
  }
}

main().catch(error => {
  console.error(`Failed to send the transfer: ${error.message}`);
  // SignerError from the Fordefi signer carries the API response body in .context
  if (error.context) {
    console.error('Error context:', JSON.stringify(error.context, null, 2));
  }
  process.exitCode = 1;
});
