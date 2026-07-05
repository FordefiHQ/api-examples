import axios from 'axios';
import * as web3 from '@solana/web3.js';
import { FordefiConfig, SwapConfig, JupiterOrderResponse, JupiterSwapResult} from './interfaces';

async function getSwapOrder(fordefiConfig: FordefiConfig, swapConfig: SwapConfig): Promise<JupiterOrderResponse> {
    console.log("Input token", swapConfig.inputToken);
    console.log("Output token", swapConfig.outputToken);

    const orderResponse = await axios.get('https://api.jup.ag/ultra/v1/order', {
        params: {
            inputMint: swapConfig.inputToken,
            outputMint: swapConfig.outputToken,
            amount: swapConfig.swapAmount,
            slippageBps: swapConfig.slippage,
            taker: fordefiConfig.fordefiSolanaVaultAddress
        },
        headers: {
            'x-api-key': swapConfig.jupiterApiKey
        }
    });

    return orderResponse.data;
}

export async function executeJupiterOrder(
    signedTransaction: string,
    requestId: string,
    jupiterApiKey: string
): Promise<any> {
    const executeResponse = await axios.post('https://api.jup.ag/ultra/v1/execute', {
        signedTransaction: signedTransaction,
        requestId: requestId,
    }, {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': jupiterApiKey
        }
    });

    return executeResponse.data;
}

export async function createJupiterSwapTx(fordefiConfig: FordefiConfig, swapConfig: SwapConfig): Promise<JupiterSwapResult> {
    console.log("SwapConfig", swapConfig);

    const order = await getSwapOrder(fordefiConfig, swapConfig);
    console.log("Order response:", {
        requestId: order.requestId,
        inAmount: order.inAmount,
        outAmount: order.outAmount
    });

    const transactionBuffer = Buffer.from(order.transaction, 'base64');
    const versionedTransaction = web3.VersionedTransaction.deserialize(transactionBuffer);

    const serializedMessage = Buffer.from(
        versionedTransaction.message.serialize()
    ).toString('base64');

    const fordefiRequestBody = {
        "vault_id": fordefiConfig.vaultId,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": "manual",
            "data": serializedMessage,
            "chain": "solana_mainnet"
        },
        "wait_for_state": "signed"
    };

    return {
        fordefiRequestBody,
        requestId: order.requestId
    };
}
