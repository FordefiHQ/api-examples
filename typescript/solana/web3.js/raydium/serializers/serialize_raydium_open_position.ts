import { VersionedTransaction, Connection, PublicKey } from '@solana/web3.js'
import { ApiV3PoolInfoConcentratedItem, TickUtils, PoolUtils, ClmmKeys, TxVersion } from '@raydium-io/raydium-sdk-v2'
import { FordefiSolanaConfig, RaydiumOpenPositionConfig } from '../raydium_open_position'
import { isValidClmm } from '../utils/is_valid_cllm'
import { getPriorityFees } from '../utils/get_priority_fees'
import { initSdk } from '../raydium_sdk_loader'
import Decimal from 'decimal.js'
import { Buffer } from 'buffer'; 
import BN from 'bn.js'


export async function openPositionWithRaydium(fordefiConfig: FordefiSolanaConfig, openPositionConfig: RaydiumOpenPositionConfig, connection: Connection){
    const fordefiVaultPubKey = new PublicKey(fordefiConfig.fordefiSolanaVaultAddress)

    const raydium = await initSdk(fordefiVaultPubKey, connection)

    let poolInfo: ApiV3PoolInfoConcentratedItem
    const poolId = openPositionConfig.raydiumPool
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

    const inputAmount = openPositionConfig.inputAmount
    const [startPrice, endPrice] = [openPositionConfig.startPrice, openPositionConfig.endPrice]

    const { tick: lowerTick } = TickUtils.getPriceAndTick({
      poolInfo,
      price: new Decimal(startPrice),
      baseIn: true,
    })

    const { tick: upperTick } = TickUtils.getPriceAndTick({
      poolInfo,
      price: new Decimal(endPrice),
      baseIn: true,
    })

    const epochInfo = await raydium.fetchEpochInfo()
    const res = await PoolUtils.getLiquidityAmountOutFromAmountIn({
      poolInfo,
      slippage: 0,
      inputA: true,
      tickUpper: Math.max(lowerTick, upperTick),
      tickLower: Math.min(lowerTick, upperTick),
      amount: new BN(new Decimal(inputAmount || '0').mul(10 ** poolInfo.mintA.decimals).toFixed(0)),
      add: true,
      amountHasFee: true,
      epochInfo: epochInfo,
    })

    const {
        transaction,      
        builder,          // NOTE: this exposes instruction arrays from the SDK
        extInfo      
      } = await raydium.clmm.openPositionFromBase({
        poolInfo,
        poolKeys,
        tickUpper: Math.max(lowerTick, upperTick),
        tickLower: Math.min(lowerTick, upperTick),
        base: 'MintA',
        ownerInfo: {
          useSOLBalance: true,
      },
      baseAmount: new BN(new Decimal(inputAmount || '0').mul(10 ** poolInfo.mintA.decimals).toFixed(0)),
      otherAmountMax: res.amountSlippageB.amount,
      txVersion: openPositionConfig.txVersion ? (openPositionConfig.txVersion === "V0" ? TxVersion.V0 : TxVersion.LEGACY) : TxVersion.V0,
      computeBudgetConfig: {
        units: openPositionConfig.cuLimit || 600000,
        microLamports: await getPriorityFees(),
      },
      // optional: set if useJito=treu
      // txTipConfig: {
      //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'), // Jitp tip account
      //   amount: new BN(openPositionConfig.jitoTip)
      // }
    })
    console.log('extInfo', extInfo);

    const instructions = builder.allInstructions;   // legacy+v0 agnostic
    console.debug('Built instructions:', instructions);

    const isV0Tx = transaction instanceof VersionedTransaction;

    const serializedTxData = Buffer.from(
      isV0Tx
        ? transaction.message.serialize()      // v0 – serialize MessageV0
        : transaction.serializeMessage()       // legacy – serialize Message
    ).toString('base64');

    let secondSignature = null;
    if (isV0Tx && transaction.signatures.length > 1) {
      secondSignature = Buffer.from(transaction.signatures[1]).toString('base64');
    } else if (!isV0Tx && transaction.signatures.length > 1) {
      const sig = transaction.signatures[1].signature;
      if (sig) {
        secondSignature = Buffer.from(sig).toString('base64');
      }
    }

    // Create payload
    const pushMode = openPositionConfig.useJito ? "manual" : "auto";
    const jsonBody = {
        "vault_id": fordefiConfig.vaultId, // Replace with your vault ID
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": pushMode,
            "data": serializedTxData, 
            "chain": "solana_mainnet",
            "signatures":[
              {data: null}, // -> IMPORTANT this is a placeholder for your Fordefi Solana Vault's signature, this must be {data: null}
              {data: secondSignature}
            ]
        },
        "wait_for_state": "signed" // only for create-and-wait    
    };

    return jsonBody;
}