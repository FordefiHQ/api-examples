import { VersionedTransaction, Connection, PublicKey } from '@solana/web3.js'
import { ApiV3PoolInfoConcentratedItem, ClmmKeys } from '@raydium-io/raydium-sdk-v2'
import { FordefiSolanaConfig, RaydiumRemoveLiquidityConfig } from '../raydium_remove_liquidity'
import { getPriorityFees } from '../utils/get_priority_fees'
import { isValidClmm } from '../utils/is_valid_cllm'
import { initSdk } from '../raydium_sdk_loader'
import { Buffer } from 'buffer'; 
import BN from 'bn.js'


export async function removeLiquidityFromRaydiumPool(fordefiConfig: FordefiSolanaConfig, removeLiquidityConfig: RaydiumRemoveLiquidityConfig, connection: Connection){
    const fordefiVaultPubKey = new PublicKey(fordefiConfig.fordefiSolanaVaultAddress)

    const raydium = await initSdk(fordefiVaultPubKey, connection)

    let poolInfo: ApiV3PoolInfoConcentratedItem
    const poolId = removeLiquidityConfig.raydiumPool
    let poolKeys: ClmmKeys | undefined

    if (raydium.cluster === 'mainnet') {
      const data = await raydium.api.fetchPoolById({ ids: poolId })
      poolInfo = data[0] as ApiV3PoolInfoConcentratedItem
      if (!isValidClmm(poolInfo.programId)) throw new Error('target pool is not CLMM pool')
    } else {
      const data = await raydium.clmm.getPoolInfoFromRpc(poolId)
      poolInfo = data.poolInfo
      poolKeys = data.poolKeys
    }

    const allPosition = await raydium.clmm.getOwnerPositionInfo({ programId: poolInfo.programId })
    if (!allPosition.length) throw new Error(`No positions detected for user -> ${fordefiConfig.fordefiSolanaVaultAddress}`)
  
    const position = allPosition.find((p) => p.poolId.toBase58() === poolInfo.id)
    if (!position) throw new Error(`No positions detected for user -> ${fordefiConfig.fordefiSolanaVaultAddress} in Raydium pool -> ${poolInfo.id}`)

    const {
        transaction,      
        builder,          // NOTE: this exposes instruction arrays from the SDK      
      } = await raydium.clmm.decreaseLiquidity({
        poolInfo,
        poolKeys,
        ownerPosition: position,
        ownerInfo: {
          useSOLBalance: true,
          closePosition: removeLiquidityConfig.closePosition
        },
        liquidity: position.liquidity,
        amountMinA: new BN(0),
        amountMinB: new BN(0),
        txVersion: removeLiquidityConfig.txVersion,
        // optional: set up priority fee here
        computeBudgetConfig: {
          units: removeLiquidityConfig.cuLimit,
          microLamports: await getPriorityFees()
        },
        // optional: set if useJito=treu
        // txTipConfig: {
        //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'), // Jitp tip account
        //   amount: new BN(removeLiquidityConfig.jitoTip)
        // }
      })

    const instructions = builder.allInstructions;   // legacy+v0 agnostic
    console.debug('Built instructions:', instructions);

    const isV0Tx = transaction instanceof VersionedTransaction;

    const serializedTxData = Buffer.from(
      isV0Tx
        ? transaction.message.serialize()      // v0 – serialize MessageV0
        : transaction.serializeMessage()       // legacy – serialize Message
    ).toString('base64');

    // Create payload
    const pushMode = removeLiquidityConfig.useJito ? "manual" : "auto";
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