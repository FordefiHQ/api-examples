import axios from 'axios';
import * as web3 from '@solana/web3.js';
import { FordefiConfig, SwapConfig } from './config';

export interface JupiterOrderResponse {
    requestId: string;
    transaction: string;
    inAmount?: string;
    outAmount?: string;
    inputMint?: string;
    outputMint?: string;
}

export interface JupiterSwapResult {
    fordefiRequestBody: object;
    requestId: string;
}

// Get order from Jupiter Ultra API
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

// Execute signed transaction via Jupiter Ultra API
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
