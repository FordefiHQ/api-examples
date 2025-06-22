import { Connection, PublicKey, SystemProgram, AddressLookupTableProgram, TransactionMessage, VersionedTransaction, AddressLookupTableAccount } from '@solana/web3.js';
import { getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { FordefiSolanaConfig } from './interfaces';

function buildFordefiRequestBody(
  fordefiConfig: FordefiSolanaConfig,
  serializedMessage: string
) {
  return {
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
      "data": serializedMessage,
      "chain": "solana_mainnet"
    },
    "wait_for_state": "signed"
  };
}

async function createAndSerializeTransaction(
  connection: Connection,
  payerKey: PublicKey,
  instructions: any[],
  lookupTables: AddressLookupTableAccount[] = []
): Promise<string> {
  const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  const messageV0 = new TransactionMessage({
    payerKey,
    recentBlockhash,
    instructions,
  }).compileToV0Message(lookupTables);
  
  const tx = new VersionedTransaction(messageV0);
  console.debug(tx);
  
  return Buffer.from(tx.message.serialize()).toString('base64');
}

export async function deriveATA(recipient: string, mint_address: string) {
  const mint = new PublicKey(mint_address);
  const walletAddress = new PublicKey(recipient);
  
  const ata = await getAssociatedTokenAddress(
    mint,        
    walletAddress,    
    false,           
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID 
  );
  
  console.log('ATA:', ata.toString());
  
  return ata;
}

export async function deriveTokenRecipientList(recipientsList: PublicKey[], mint: string): Promise<PublicKey[]> {
  const mintPubKey = new PublicKey(mint);
  const tokenRecipients = [];
  
  for (const wallet of recipientsList) {
    const ata = await getAssociatedTokenAddress(
      mintPubKey,
      wallet,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    tokenRecipients.push(ata);
  }
  
  return tokenRecipients;
}

export async function createAlt( 
  connection: Connection,
  fordefiVault: PublicKey,
  fordefiConfig: FordefiSolanaConfig
) {
  const recentSlot = await connection.getSlot();
  const [createIx, tableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: fordefiVault,
    payer: fordefiVault,
    recentSlot
  });
  
  console.debug(`Your ALT will be created at https://solscan.io/account/${tableAddress}`);
  
  const serializedMessage = await createAndSerializeTransaction(
    connection,
    fordefiVault,
    [createIx]
  );
  
  return buildFordefiRequestBody(fordefiConfig, serializedMessage);
}

export async function extendAlt(
  connection: Connection,
  fordefiVault: PublicKey,
  fordefiConfig: FordefiSolanaConfig,
  tableAddress: PublicKey,
  recipients: PublicKey[]
) {
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: fordefiVault,
    authority: fordefiVault,
    lookupTable: tableAddress,
    addresses: recipients,
  });
  
  const serializedMessage = await createAndSerializeTransaction(
    connection,
    fordefiVault,
    [extendIx]
  );
  
  return buildFordefiRequestBody(fordefiConfig, serializedMessage);
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
      toPubkey: dest,
      lamports: amountPerRecipient,
    })
  );
  
  const tableAccount = (await connection.getAddressLookupTable(tableAddress)).value!;
  
  const serializedMessage = await createAndSerializeTransaction(
    connection,
    fordefiVault,
    batchIxs,
    [tableAccount]
  );
  
  return buildFordefiRequestBody(fordefiConfig, serializedMessage);
}

export async function doSplBatch(
  connection: Connection,
  fordefiVault: PublicKey,
  fordefiConfig: FordefiSolanaConfig,
  tableAddress: PublicKey,
  walletAddresses: PublicKey[],
  amountPerRecipient: bigint,
  mint: string,
) {
  const mintPubKey = new PublicKey(mint);
  const sourceATA = await getAssociatedTokenAddress(
    mintPubKey,
    fordefiVault,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const createAtaIxs = [];
  const recipientATAs = [];
  
  for (let i = 0; i < walletAddresses.length; i++) {
    const walletAddress = walletAddresses[i];
    
    const ata = await getAssociatedTokenAddress(
      mintPubKey,
      walletAddress,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    recipientATAs.push(ata);
    
    try {
      const account = await connection.getAccountInfo(ata);
      if (!account) {
        createAtaIxs.push(
          createAssociatedTokenAccountInstruction(
            fordefiVault,    // payer
            ata,             // ATA address to create
            walletAddress,   // owner (wallet address)
            mintPubKey       // mint
          )
        );
        console.log(`Will create ATA ${ata.toString()} for wallet ${walletAddress.toString()}`);
      } else {
        console.log(`ATA ${ata.toString()} already exists for wallet ${walletAddress.toString()}`);
      }
    } catch (error) {
      console.log(`Error checking account ${ata.toString()}: ${error}`);
      createAtaIxs.push(
        createAssociatedTokenAccountInstruction(
          fordefiVault,    // payer
          ata,             // ATA address to create
          walletAddress,   // owner (wallet address)
          mintPubKey       // mint
        )
      );
    }
  }

  const transferIxs = recipientATAs.map(recipientATA =>
    createTransferInstruction(
      sourceATA,           // source ATA
      recipientATA,        // destination ATA
      fordefiVault,        // authority
      amountPerRecipient   // amount
    )
  );

  const allInstructions = [...createAtaIxs, ...transferIxs];

  const tableAccount = (await connection.getAddressLookupTable(tableAddress)).value!;

  const serializedMessage = await createAndSerializeTransaction(
    connection,
    fordefiVault,
    allInstructions,
    [tableAccount]
  );

  return buildFordefiRequestBody(fordefiConfig, serializedMessage);
}