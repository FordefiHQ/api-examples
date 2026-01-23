import { LayerswapWithdrawParams, LayerswapSwapResult } from "./interfaces.js";
import { LAYERSWAP_API_URL } from "./config.js";
import { Call } from "starknet";
import axios from "axios";


async function createLayerswapSwap(params: {
    apiKey: string;
    sourceAddress: string;
    destinationAddress: string;
    amount: string;
    destinationNetwork: string;
}): Promise<LayerswapSwapResult> {
    try {
        const response = await axios.post(
            `${LAYERSWAP_API_URL}/swaps`,
            {
                source_network: "PARADEX_MAINNET",
                destination_network: params.destinationNetwork,
                source_address: params.sourceAddress,
                destination_address: params.destinationAddress,
                amount: parseFloat(params.amount),
                source_token: "USDC",
                destination_token: "USDC"
            },
            {
                headers: {
                    "X-LS-APIKEY": params.apiKey,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = response.data.data;
        const swapId = data.swap.id;
        const depositAddress = data.deposit_actions[0].to_address;
        const callDataJson = JSON.parse(data.deposit_actions[0].call_data);
        const bridgeCalls: Call[] = callDataJson.slice(1).map((call: any) => ({
            contractAddress: call.contractAddress,
            entrypoint: call.entrypoint,
            calldata: call.calldata.map((c: any) =>
                typeof c === 'object' ? [c.low, c.high] : c
            ).flat()
        }));

        return { swapId, depositAddress, bridgeCalls };
    } catch (error: any) {
        if (error.response?.data) {
            console.error('Layerswap API error response:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

export async function withdrawWithLayerswap({
    paradexClient,
    paradexAction,
    destinationAddress,
    layerswapApiKey,
    destinationNetwork = "ETHEREUM_MAINNET"
}: LayerswapWithdrawParams) {
    try {
        const sourceAddress = paradexClient.getAddress();

        const withdrawInfo = await paradexClient.getMaxWithdraw('USDC');
        console.log(`Max withdraw: ${withdrawInfo.amountChain} USDC`);

        const receivable = await paradexClient.getReceivableAmount('USDC', paradexAction.amountToWithdraw);
        if (Number(receivable.socializedLossFactor) !== 0) {
            console.log(
                `Socialized loss is active. You will receive ${receivable.receivableAmount} USDC.`);
        }

        console.log(`Creating Layerswap swap for ${receivable.receivableAmount} USDC...`);

        const { swapId, depositAddress, bridgeCalls } = await createLayerswapSwap({
            apiKey: layerswapApiKey,
            sourceAddress,
            destinationAddress,
            amount: receivable.receivableAmount,
            destinationNetwork
        });

        console.log(`Layerswap swap created: ${swapId}`);
        console.log(`Deposit address: ${depositAddress}`);
        console.log(`Bridge calls to execute: ${bridgeCalls.length}`);

        console.log(`Executing withdrawal of ${receivable.receivableAmount} USDC via Layerswap...`);
        const withdrawResult = await paradexClient.withdraw(
            'USDC',
            receivable.receivableAmount,
            bridgeCalls
        );

        console.log('Waiting for transaction to complete on L2...');
        console.log(`You can monitor the L2 tx at: https://app.paradex.trade/explorer/tx/${withdrawResult.hash}`);

        const withdrawalStatus = await paradexClient.waitForTransaction(withdrawResult.hash);

        if (withdrawalStatus.isSuccess()) {
            console.log('\nLayerswap withdrawal transaction succeeded on L2!');
            console.log(`Layerswap will bridge funds to ${destinationAddress} within minutes.`);
            console.log(`Swap ID: ${swapId}`);
        } else if (withdrawalStatus.isReverted()) {
            console.error('Withdrawal transaction was reverted');
            console.error('Revert reason:', withdrawalStatus.revert_reason);
        } else if (withdrawalStatus.isError()) {
            console.error('Withdrawal transaction encountered an error');
        }

    } catch (error) {
        console.error('Layerswap withdrawal failed:', error);
    }
}
