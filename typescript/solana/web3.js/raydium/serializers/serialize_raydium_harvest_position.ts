import { VersionedTransaction, Connection, PublicKey, TransactionMessage, Transaction } from '@solana/web3.js'
import { ApiV3PoolInfoConcentratedItem, CLMM_PROGRAM_ID, ClmmPositionLayout } from '@raydium-io/raydium-sdk-v2'
import { FordefiSolanaConfig, RaydiumHarvestPositionConfig } from '../raydium_harvest_position'
import { getPriorityFees } from '../utils/get_priority_fees'
import { initSdk } from '../raydium_sdk_loader'
import { Buffer } from 'buffer'; 
import BN from 'bn.js'


export async function harvestPositionWithRaydium(fordefiConfig: FordefiSolanaConfig, harvestPositionConfig: RaydiumHarvestPositionConfig, connection: Connection){
    const fordefiVaultPubKey = new PublicKey(fordefiConfig.fordefiSolanaVaultAddress)

    const raydium = await initSdk(fordefiVaultPubKey, connection)

    const allPosition = await raydium.clmm.getOwnerPositionInfo({ programId: CLMM_PROGRAM_ID })
    const nonZeroPosition = allPosition.filter((p) => !p.liquidity.isZero())
    if (!nonZeroPosition.length)
      throw new Error(`Non-zero positions NOT detected for user ${fordefiConfig.fordefiSolanaVaultAddress} -> ${allPosition.length}`)
  
    const positionPoolInfoList = (await raydium.api.fetchPoolById({
      ids: nonZeroPosition.map((p) => p.poolId.toBase58()).join(','),
    })) as ApiV3PoolInfoConcentratedItem[]
  
    const allPositions = nonZeroPosition.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.poolId.toBase58()]: acc[cur.poolId.toBase58()] ? acc[cur.poolId.toBase58()].concat(cur) : [cur],
      }),
      {} as Record<string, ClmmPositionLayout[]>
    )

    const {      
        builder,          // NOTE: this exposes instruction arrays from the SDK      
      } = await raydium.clmm.harvestAllRewards({
        allPoolInfo: positionPoolInfoList.reduce(
          (acc, cur) => ({
            ...acc,
            [cur.id]: cur,
          }),
          {}
        ),
        allPositions,
        ownerInfo: {
          useSOLBalance: true,
        },
        programId: CLMM_PROGRAM_ID,
        txVersion: harvestPositionConfig.txVersion,
        computeBudgetConfig: {
          units: harvestPositionConfig.cuLimit,
          microLamports: await getPriorityFees(),
        },
        // optional: set if useJito=treu
        // txTipConfig: {
        //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'), // Jitp tip account
        //   amount: new BN(harvestPositionConfig.jitoTip),
        // },
      })

      const instructions = builder.allInstructions;   // legacy+v0 agnostic
      console.debug('Built instructions:', instructions);
      
      const { blockhash } = await connection.getLatestBlockhash();
      
      let transaction: any;
      let serializedTxData;
      
      const isV0 = harvestPositionConfig.txVersion === 0;
      
      if (isV0) {
        const messageV0 = new TransactionMessage({
          payerKey: fordefiVaultPubKey,
          recentBlockhash: blockhash,
          instructions
        }).compileToV0Message();
        
        transaction = new VersionedTransaction(messageV0);
        serializedTxData = Buffer.from(transaction.message.serialize()).toString('base64');
      } else {
        transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fordefiVaultPubKey;
        
        instructions.forEach(instruction => {
          transaction.add(instruction);
        });
        
        serializedTxData = Buffer.from(transaction.serializeMessage()).toString('base64');
      }

    // Create payload
    const pushMode = harvestPositionConfig.useJito ? "manual" : "auto";
    const jsonBody = {
        "vault_id": fordefiConfig.vaultId, // Replace with your vault ID
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": pushMode,
            "data": serializedTxData,
            "chain": "solana_mainnet"
        },
        "wait_for_state": "signed" // only for create-and-wait    
    };

    return jsonBody;
}