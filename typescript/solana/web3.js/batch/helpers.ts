import {
    Connection, PublicKey, SystemProgram,
    AddressLookupTableProgram, TransactionMessage,
    VersionedTransaction
  } from '@solana/web3.js';
import { FordefiSolanaConfig } from './run';
  
export async function createAlt(
  connection: Connection,
  fordefiVault: PublicKey,
  fordefiConfig: FordefiSolanaConfig,
  recipients: PublicKey[],
  lamportsPerRecipient: bigint
) {
  // ---------- 1. create a fresh table (one-off) ----------
  const recentSlot = await connection.getSlot();
  const [createIx, tableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: fordefiVault,
      payer:     fordefiVault,
      recentSlot
    });
  const compiledCreateLAlt = new VersionedTransaction(
    new TransactionMessage({
      payerKey: fordefiVault,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [createIx],
    }).compileToV0Message()
  );

  // Compile + serialize the swap tx
  const serializedV0Message = Buffer.from(
    compiledCreateLAlt.serialize()
  ).toString('base64');

  // Create JSON
  //const pushMode = swapConfig.useJito ? "manual" : "auto";
  const jsonBody = {

      "vault_id": fordefiConfig.vaultId, // Replace with your vault ID
      "signer_type": "api_signer",
      "sign_mode": "auto", // IMPORTANT
      "type": "solana_transaction",
      "details": {
          "type": "solana_serialized_transaction_message",
          "push_mode": "auto", // IMPORTANT,
          "data": serializedV0Message,  // For legacy transactions, use `serializedLegacyMessage`
          "chain": "solana_mainnet"
      },
      "wait_for_state": "signed" // only for create-and-wait
      
  };

  return jsonBody;

  // // ---------- 2. extend with the addresses you'll batch ----------
  // const extendIx = AddressLookupTableProgram.extendLookupTable({
  //   payer:      fordefiVault,
  //   authority:  fordefiVault,
  //   lookupTable: tableAddress,
  //   addresses:   recipients,
  // });
  // const extendTx = new VersionedTransaction(
  //   new TransactionMessage({
  //     payerKey: fordefiVault,
  //     recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  //     instructions: [extendIx],
  //   }).compileToV0Message()
  // );

  
  // // ---------- 3. build your batched instructions ----------
  // const batchIxs = recipients.map(dest =>
  //   SystemProgram.transfer({
  //     fromPubkey: fordefiVault,
  //     toPubkey:   dest,
  //     lamports:   lamportsPerRecipient,
  //   })
  // );
  
  // // ---------- 4. fetch the table & compile a v0 message ----------
  // const tableAccount = (await connection.getAddressLookupTable(tableAddress)).value!;
  // const messageV0 = new TransactionMessage({
  //   payerKey: fordefiVault,
  //   recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  //   instructions: batchIxs,
  // }).compileToV0Message([tableAccount]);   // <<— lookup here
  
  // const tx = new VersionedTransaction(messageV0);
  // tx.sign([payer]);                        // signers **must** be inline
  // const sig = await connection.sendTransaction(tx);
  // return sig;
}

const connection = new Connection('https://api.mainnet-beta.solana.com');
const fordefiVault =  new PublicKey('CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim')
const alice = new PublicKey("9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS");
const bob = new PublicKey("FEwZdEBick94iFJcuVQS2gZyqhSDunSs82FTZgk26RpD");
const recipients: PublicKey[] = [alice, bob];

