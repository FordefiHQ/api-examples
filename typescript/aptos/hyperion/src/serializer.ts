import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { FordefiAptosConfig, sdk, POSITION_ID, removeRatio } from "./config";

export async function buildPayload(fordefiConfig: FordefiAptosConfig, APTOS_NETWORK: Network) {
    const config = new AptosConfig({ network: APTOS_NETWORK });
    const aptos = new Aptos(config);

    const originVaultAddress = fordefiConfig.originAddress;

    const senderAccount = await aptos.account.getAccountInfo({
        accountAddress: originVaultAddress
    });
    const sequenceNumber = senderAccount.sequence_number;
    console.log(`Current sequence number: ${sequenceNumber}`);

    const position = await sdk.Position.fetchPositionById({
        positionId: POSITION_ID,
        address: originVaultAddress,
    });
    console.log("Position details:", JSON.stringify(position, null, 2));

    const [currencyAAmount, currencyBAmount] = await sdk.Position.fetchTokensAmountByPositionId({
        positionId: POSITION_ID,
    });
    console.log(`Token amounts - A: ${currencyAAmount}, B: ${currencyBAmount}`);
    
    const removeLiquidityPayload = sdk.Position.removeLiquidityTransactionPayload({
        positionId: POSITION_ID,
        currencyA: position[0].pool[0].token1,
        currencyB: position[0].pool[0].token2,
        currencyAAmount: Math.floor(currencyAAmount * removeRatio),
        currencyBAmount: Math.floor(currencyBAmount * removeRatio),
        deltaLiquidity: Math.floor(position[0].currentAmount * removeRatio),
        slippage: 0.5, // in %
        recipient: originVaultAddress,
    });

    const transaction = await aptos.transaction.build.simple({
        sender: originVaultAddress,
        data: removeLiquidityPayload,
        withFeePayer: true,
    });

    const rawTransaction = transaction.rawTransaction

    const [simulatedTransactionResult] = await aptos.transaction.simulate.simple({
        transaction,
    });
    console.debug("Simulation successful: ", simulatedTransactionResult?.success);

    const txPayload = rawTransaction.payload;
    const txBytes = txPayload.bcsToBytes();
    const base64EncodedTransaction = Buffer.from(txBytes).toString('base64');

    const payload = {
        vault_id: fordefiConfig.originVaultId,
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: "aptos_transaction",
        details: {
            skip_prediction: false,
            fail_on_prediction_failure: true,
            type: 'aptos_serialized_entry_point_payload',
            chain: 'aptos_mainnet',
            serialized_transaction_payload: base64EncodedTransaction,
            push_mode: 'auto'
        }
    };

    return payload;
}