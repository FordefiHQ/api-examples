import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { FordefiSolanaConfig, RaydiumSwapConfig } from '../raydium_swap'
import { API_URLS } from '@raydium-io/raydium-sdk-v2'
import { getPriorityFees } from '../utils/get_priority_fees'
import { PublicKey } from '@solana/web3.js'
import axios from 'axios'

export async function swapWithRaydium(fordefiConfig: FordefiSolanaConfig, swapConfig: RaydiumSwapConfig){
    const fordefiVaultPubKey = new PublicKey(fordefiConfig.fordefiSolanaVaultAddress)
    const inputTokenMint = new PublicKey(swapConfig.inputMint)
    console.debug("SwapResponse", swapConfig)

    const { data: swapResponse } = await axios.get(
        `${
          API_URLS.SWAP_HOST
        }/compute/swap-base-in?inputMint=${swapConfig.inputMint}&outputMint=${swapConfig.outputMint}&amount=${swapConfig.swapAmount}&slippageBps=${
            swapConfig.slippage * 100}&txVersion=${swapConfig.txVersion}`
      ) // Use the URL xxx/swap-base-in or xxx/swap-base-out to define the swap type. 
    console.debug("SwapResponse", swapResponse)

    const { data: swapTransactions } = await axios.post<{
        id: string
        version: string
        success: boolean
        data: { transaction: string }[]
      }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
        computeUnitPriceMicroLamports: String(await getPriorityFees()),
        swapResponse,
        txVersion: swapConfig.txVersion,
        wallet: fordefiVaultPubKey.toBase58(),
        wrapSol: swapConfig.isInputSol,
        unwrapSol: swapConfig.isOutputSol, // true means output mint receive sol, false means output mint received wsol
        inputAccount: swapConfig.isInputSol ? undefined : inputTokenMint?.toBase58(),
      })

      const isV0Tx = swapConfig.txVersion === "V0";
      const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'))
      const allTransactions = allTxBuf.map((txBuf) =>
        isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
      )
    
      console.log(`total ${allTransactions.length} transactions`, swapTransactions)

    const serializedTxData = Buffer.from(
      isV0Tx
        ? (allTransactions[0] as VersionedTransaction).message.serialize()
        : (allTransactions[0] as Transaction).serializeMessage()
    ).toString('base64');

    // Create payload
    const pushMode = swapConfig.useJito ? "manual" : "auto";
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