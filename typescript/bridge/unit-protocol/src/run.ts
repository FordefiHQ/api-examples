import { get_deposit_address } from './get-address'
import { verifyDepositAddressSignatures } from './verify-data'
import { buildBitcoinTransactionPayload } from './api_request/buildPayload'
import { signWithApiUserPrivateKey } from './api_request/signer'
import { createAndSignTx } from './api_request/pushToApi'
import { getTransaction } from './api_request/getTransaction'
import { Proposal } from './interfaces'
import { fordefiConfig } from './config'
import { MIN_BTC_DEPOSIT_SATS } from './constants'


/**
 * Build, sign and submit a native testnet BTC transfer from the Fordefi vault
 * to the (already-verified) Hyperunit deposit address.
 */
async function fundDepositAddress(depositAddress: string) {
    const requestJson = buildBitcoinTransactionPayload(
        fordefiConfig.vaultId,
        depositAddress,
        fordefiConfig.transferAmount,
        `Unit deposit to ${fordefiConfig.hyperliquid_address}`,
    )
    const requestBody = JSON.stringify(requestJson)
    const timestamp = new Date().getTime()
    const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`

    const signature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, payload)
    const resp = await createAndSignTx(
        fordefiConfig.pathEndpoint,
        fordefiConfig.accessToken,
        signature,
        timestamp,
        requestBody,
    )

    console.log(`Submitted ${fordefiConfig.transferAmount} sats to ${depositAddress} (tx id: ${resp.data.id}, state: ${resp.data.state})`)

    return resp.data.id as string
}

/**
 * Poll the transaction until it reaches "pushed_to_blockchain" (when the on-chain
 * hash gets populated), then print the testnet4 mempool.space explorer link.
 * Short poll — just long enough to clear the signing states; the actual BTC
 * confirmation happens later on-chain.
 */
async function showExplorerLink(txId: string, maxAttempts = 20, intervalMs = 3000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const resp = await getTransaction(txId, fordefiConfig.accessToken)
        const state: string = resp.data.state

        if (state === 'pushed_to_blockchain') {
            const txHash: string = resp.data.hash
            const explorerUrl: string | undefined = resp.data.explorer_url
            console.log(`Hash: ${txHash}`)
            console.log(`Track it here: ${explorerUrl ?? `https://mempool.space/testnet4/tx/${txHash}`}`)
            return
        }

        console.log(`Waiting for broadcast (state: ${state}, attempt ${attempt}/${maxAttempts})...`)
        await new Promise((r) => setTimeout(r, intervalMs))
    }

    console.warn(`Tx ${txId} not pushed to blockchain after ${maxAttempts} attempts — check the Fordefi dashboard.`)
}

async function main() {
    try {
        // Hard guard against Unit's loss-of-funds policy: deposits below the
        // minimum are NOT credited and NOT refunded. Fail before doing anything.
        const transferAmount = Number(fordefiConfig.transferAmount)
        if (!Number.isInteger(transferAmount) || transferAmount < MIN_BTC_DEPOSIT_SATS) {
            console.error(
                `BTC_TRANSFER_AMOUNT (${fordefiConfig.transferAmount} sats) is invalid or below the Unit minimum of ${MIN_BTC_DEPOSIT_SATS} sats (0.0003 BTC). ` +
                `Deposits below this amount are LOST — aborting.`,
            )
            return
        }

        const data = await get_deposit_address(fordefiConfig.hyperliquid_address)

        // Build the proposal that the guardian nodes signed over, for a
        // BTC -> Hyperliquid deposit. Current guardians sign the MODERN payload:
        //   {nodeId}:user-{coinType}-{destinationChain}-{destinationAddress}-{address}
        // so coinType must be set. verifyDepositAddressSignatures tries the legacy
        // format first, then falls back to this modern one using coinType.
        const proposal: Proposal = {
            destinationAddress: fordefiConfig.hyperliquid_address,
            destinationChain: 'hyperliquid',
            asset: 'btc',
            address: data.address,
            sourceChain: 'bitcoin',
            coinType: 'bitcoin',
        }

        const result = await verifyDepositAddressSignatures(data.signatures, proposal)

        if (!result.success) {
            console.error(`Verification FAILED — only ${result.verifiedCount} valid signature(s), threshold not met. Do NOT fund this address.`)
            console.log('Per-node results:', result.verificationDetails)
            if (result.errors) console.error('Errors:', result.errors)
            return
        }

        console.log(`Verified deposit address (${result.verifiedCount} guardian signatures): ${data.address}`)
        console.log('Per-node results:', result.verificationDetails)

        // Address is trusted by a quorum of guardians —> fund it through Fordefi
        const txId = await fundDepositAddress(data.address)
        await showExplorerLink(txId)
    } catch (error) {
        console.error("Oops, an error occured: ", error)
    }
}

main().catch(error => {
    console.error("Unhandled error:", error);
});
