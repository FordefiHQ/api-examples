import * as kit from '@solana/kit';
import { getTransferSolInstruction } from '@solana-program/system';
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
 * build the message as a regular recent-blockhash transaction and do NOT
 * reference the nonce account - when the vault has a free nonce account,
 * Fordefi replaces the blockhash with the stored durable nonce and prepends the
 * AdvanceNonceAccount instruction before signing. (Referencing the managed
 * nonce account yourself in the message is rejected by the API.) When no nonce
 * account is free, Fordefi signs with a fresh recent blockhash instead.
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
  // A placeholder recent blockhash: Fordefi overrides it (with the durable
  // nonce, when a free nonce account exists) right before signing. If the
  // recipient account does not exist yet, the amount must be at least the
  // rent-exempt minimum (~0.0009 SOL) or the transaction is reverted.
  const { value: blockhash } = await createClient().getLatestBlockhash().send();
  // A noop signer marks the vault as the signing account in the message (fee
  // payer and transfer source) without signing locally: Fordefi fills in the
  // MPC signature, and the nonce-authority signature it adds itself.
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
  // The vault is the fee payer but signs nowhere locally: the message is
  // submitted unsigned and Fordefi fills in the MPC signature.
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
    console.log('Note: Fordefi built this transaction on a regular recent blockhash (no free nonce account found)');
  }

  const rawTx = finalTx.raw_transaction ?? finalTx.solana_transaction?.raw_transaction;
  if (rawTx) {
    const signature = kit.getSignatureFromTransaction(kit.getTransactionDecoder().decode(new Uint8Array(Buffer.from(rawTx, 'base64'))));
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
