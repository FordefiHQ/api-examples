import * as kit from '@solana/kit';
import { getTransferSolInstruction } from '@solana-program/system';
import { fordefiConfig, transferConfig } from './config';
import { fordefiGet, fordefiPost, pollUntilTerminal } from '../utils/fordefi-rest';
import { fetchNonceAccount } from '../utils/nonce-account';
import { createClient } from '../utils/solana-client-util';

/**
 * Sends a SOL transfer that uses the vault's durable nonce as its lifetime
 * instead of a recent blockhash. Fordefi sets the lifetime when it signs, so
 * approval time never causes expiration. The durable nonce keeps the signed
 * transaction valid until it lands, with no 150-block limit.
 *
 * Fordefi manages the nonce account that `npm run create-nonce-account`
 * creates. Build the message as a regular recent-blockhash transaction and
 * don't reference the nonce account, because the API rejects messages that do.
 * If the vault has a free nonce account, Fordefi replaces the blockhash with
 * the stored durable nonce and prepends the AdvanceNonceAccount instruction
 * before signing. If no nonce account is free, Fordefi signs with a fresh
 * recent blockhash.
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

  const vault = fordefiConfig.vaultAddress;
  const destination = transferConfig.destinationAddress;
  // Placeholder blockhash. Fordefi replaces it at signing time with the
  // durable nonce, or with a fresh blockhash if no nonce account is free.
  // If the recipient account doesn't exist yet, the amount must be at least
  // the rent-exempt minimum (about 0.0009 SOL), or the transaction reverts.
  const { value: blockhash } = await createClient().getLatestBlockhash().send();
  // A noop signer marks the vault as a signer in the message, as fee payer and
  // transfer source, without signing locally. Fordefi adds the MPC signature,
  // which also covers the nonce authority on the AdvanceNonceAccount instruction.
  const vaultSigner = kit.createNoopSigner(kit.address(vault));
  const txMessage = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    message => kit.setTransactionMessageFeePayerSigner(vaultSigner, message),
    message => kit.setTransactionMessageLifetimeUsingBlockhash(blockhash, message),
    message => kit.appendTransactionMessageInstructions([
      getTransferSolInstruction({
        source: vaultSigner,
        destination: kit.address(destination),
        amount: transferConfig.amountLamports,
      }),
    ], message),
  );
  // Submit the compiled message unsigned. Fordefi signs it.
  const data = Buffer.from(kit.compileTransaction(txMessage).messageBytes).toString('base64');

  console.log(`Sending ${transferConfig.amountLamports} lamports to ${destination}`);
  const created = await fordefiPost(fordefiConfig, '/api/v1/transactions', {
    vault_id: fordefiConfig.vaultId,
    signer_type: 'api_signer',
    sign_mode: 'auto',
    type: 'solana_transaction',
    details: {
      type: 'solana_serialized_transaction_message',
      chain: fordefiConfig.chain,
      data,
      push_mode: 'auto',
    },
  });
  console.log(`Transaction submitted to Fordefi (id: ${created.id})`);

  const finalTx = await pollUntilTerminal(fordefiConfig, created.id);
  console.log(`Transfer ${finalTx.state}`);

  if (finalTx.durable_nonce_account_address) {
    const nonceAccount = await fetchNonceAccount(createClient(), finalTx.durable_nonce_account_address);
    console.log(
      `Built on durable nonce account ${finalTx.durable_nonce_account_address} ` +
      `(stored nonce now: ${nonceAccount.durableNonce}) - no blockhash expiration`,
    );
  } else {
    console.log('Note: Fordefi built this transaction on a regular recent blockhash (no free nonce account found)');
  }

  const rawTx = finalTx.raw_transaction ?? finalTx.solana_transaction?.raw_transaction;
  if (rawTx) {
    const signature = kit.getSignatureFromTransaction(kit.getTransactionDecoder().decode(new Uint8Array(Buffer.from(rawTx, 'base64'))));
    console.log(`Signature on ${fordefiConfig.chain}: ${signature}`);
  }
}

main().catch(error => {
  console.error(`Failed to send the transfer: ${error.message}`);
  // A SignerError from the Fordefi signer has the API response body in .context
  if (error.context) {
    console.error('Error context:', JSON.stringify(error.context, null, 2));
  }
  process.exitCode = 1;
});
