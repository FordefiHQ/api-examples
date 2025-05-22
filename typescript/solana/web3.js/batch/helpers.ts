import { Connection, PublicKey, SystemProgram, AddressLookupTableProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { FordefiSolanaConfig } from './run';
  
export async function createAlt( 
  connection: Connection,
  fordefiVault: PublicKey,
  fordefiConfig: FordefiSolanaConfig
) {
  const recentSlot = await connection.getSlot();
  const [createIx, tableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: fordefiVault,
      payer:     fordefiVault,
      recentSlot
    });
  const createTx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: fordefiVault,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [createIx],
    }).compileToV0Message()
  );
  console.debug(`Your ALT will be created at https://solscan.io/account/${tableAddress}`)

  const serializedCreateMessage = Buffer.from(createTx.message.serialize()).toString('base64');

  const jsonBody = {
    "vault_id": fordefiConfig.vaultId,
    "signer_type": "api_signer",
    "sign_mode": "auto",
    "type": "solana_transaction",
    "details": {
      "fee": {
        "type": "priority",
        "priority_level": "medium"
      },
      "type": "solana_serialized_transaction_message",
      "push_mode": "auto",
      "data": serializedCreateMessage,
      "chain": "solana_mainnet"
    },
    "wait_for_state": "signed"
  };
  
  return jsonBody;

}

export async function extendAlt(
  connection: Connection,
  fordefiVault: PublicKey,
  fordefiConfig: FordefiSolanaConfig,
  tableAddress: PublicKey,
  recipients: PublicKey[]
) {
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer:      fordefiVault,
    authority:  fordefiVault,
    lookupTable: tableAddress,
    addresses:   recipients,
  });
  const extendTx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: fordefiVault,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [extendIx],
    }).compileToV0Message()
  );
  
  console.debug(extendTx);

  const serializedExtendMessage = Buffer.from(extendTx.message.serialize()).toString('base64');

  const jsonBody = {
    "vault_id": fordefiConfig.vaultId,
    "signer_type": "api_signer",
    "sign_mode": "auto",
    "type": "solana_transaction",
    "details": {
      "fee": {
        "type": "priority",
        "priority_level": "medium"
      },
      "type": "solana_serialized_transaction_message",
      "push_mode": "auto",
      "data": serializedExtendMessage,
      "chain": "solana_mainnet"
    },
    "wait_for_state": "signed"
  };

  return jsonBody;
}

export async function doBatch(
  connection: Connection,
  fordefiVault: PublicKey,
  fordefiConfig: FordefiSolanaConfig,
  tableAddress: PublicKey,
  recipients: PublicKey[],
  amountPerRecipient: bigint
) {

  const batchIxs = recipients.map(dest =>
    SystemProgram.transfer({
      fromPubkey: fordefiVault,
      toPubkey:   dest,
      lamports:   amountPerRecipient,
    })
  );
  
  const tableAccount = (await connection.getAddressLookupTable(tableAddress)).value!;
  const messageV0 = new TransactionMessage({
    payerKey: fordefiVault,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: batchIxs,
  }).compileToV0Message([tableAccount]); 
  
  const batchTx = new VersionedTransaction(messageV0);
  console.debug(batchTx);

  const serializedBatchMessage = Buffer.from(batchTx.message.serialize()).toString('base64');

  const jsonBody = {
    "vault_id": fordefiConfig.vaultId,
    "signer_type": "api_signer",
    "sign_mode": "auto",
    "type": "solana_transaction",
    "details": {
      "fee": {
        "type": "priority",
        "priority_level": "medium"
      },
      "type": "solana_serialized_transaction_message",
      "push_mode": "auto",
      "data": serializedBatchMessage,
      "chain": "solana_mainnet"
    },
    "wait_for_state": "signed"
  };

  return jsonBody;
}