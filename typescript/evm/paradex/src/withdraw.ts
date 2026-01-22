import { ParadexClient } from "@paradex/sdk";
import { ParadexAction } from "./config.js";

export async function withdraw(paradexClient: ParadexClient, paradexAction: ParadexAction){
    try {
        const withdrawInfo = await paradexClient.getMaxWithdraw('USDC');
        console.log(`Max withdraw: ${withdrawInfo.amountChain} USDC`);

        const receivable = await paradexClient.getReceivableAmount('USDC', paradexAction.amountToWithdraw);
        if (Number(receivable.socializedLossFactor) !== 0) {
        console.log(
            `Socialized loss is active. You will receive ${receivable.receivableAmount} USDC.`);
        }
        console.log(`Requesting withdrawal of ${receivable.receivableAmount} USDC...`);
        const withdrawResult = await paradexClient.withdraw('USDC', receivable.receivableAmount, []);
        console.log('Waiting for transaction to complete on L2...');
        const withdrawalStatus = await paradexClient.waitForTransaction(withdrawResult.hash);

        if (withdrawalStatus.isSuccess()) {
            console.log('Withdrawal transaction succeeded on L2!');
            console.log('\nNote: Funds will arrive on Ethereum L1 after the batch is proven (typically 4-12 hours is using the default StakGate bridge).');
            console.log(`You can monitor the withdrawal to L1 at: https://app.paradex.trade/explorer/tx/${withdrawResult.hash}`);
        } else if (withdrawalStatus.isReverted()) {
            console.error('Withdrawal transaction on L2 was reverted');
            console.error('Revert reason:', withdrawalStatus.revert_reason);
        } else if (withdrawalStatus.isError()) {
            console.error('Withdrawal transaction on L2 encountered an error');
        }

    } catch(error){
        console.error('Withdrawal failed:', error);
    }
}