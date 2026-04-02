import axios from 'axios';
import { ethers, parseUnits, formatUnits } from 'ethers';
import { HyperliquidConfig, fordefiConfig } from './config'
import { buildEvmTransactionPayload } from './api_request/buildPayload';
import { signWithApiUserPrivateKey } from './api_request/signer';
import { createAndSignTx } from './api_request/pushToApi';

export async function deposit(hyperliquidConfig: HyperliquidConfig) {
    const usdcAddress = hyperliquidConfig.usdcAddress ?? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const hyperliquidBridgeAddress = hyperliquidConfig.bridgeAddress ?? "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
    const amount = parseUnits(hyperliquidConfig.amount ?? "5", 6).toString();

    // ABI-encode the ERC-20 transfer call
    const erc20Interface = new ethers.Interface(["function transfer(address,uint256)"]);
    const calldata = erc20Interface.encodeFunctionData('transfer', [hyperliquidBridgeAddress, amount]);

    console.log(`Transferring ${formatUnits(amount, 6)} USDC to Hyperliquid bridge...`);

    // Send the transfer via Fordefi API
    const txEndpoint = fordefiConfig.pushMode === 'manual'
        ? '/api/v1/transactions/create-and-wait'
        : '/api/v1/transactions';
    const txPayload = buildEvmTransactionPayload(
        fordefiConfig.vaultId,
        'arbitrum_mainnet',
        usdcAddress,
        calldata,
        '0',
        fordefiConfig.pushMode,
    );
    if (fordefiConfig.pushMode === 'manual') {
        (txPayload as any).wait_for_state = 'signed';
        (txPayload as any).timeout = 45;
    }
    const txBody = JSON.stringify(txPayload);

    const txTimestamp = new Date().getTime();
    const txSigningPayload = `${txEndpoint}|${txTimestamp}|${txBody}`;
    const txApiSignature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, txSigningPayload);

    console.log(`Sending transfer transaction to Fordefi API (push_mode: ${fordefiConfig.pushMode})...`);
    const txResponse = await createAndSignTx(
        txEndpoint,
        fordefiConfig.accessToken,
        txApiSignature,
        txTimestamp,
        txBody,
    );

    let txData = txResponse.data;

    if (fordefiConfig.pushMode === 'manual') {
        console.log(`Transaction signed but NOT broadcast (push_mode: manual).`);
        console.log(`Transaction ID: ${txData.id}`);
        console.log(`State: ${txData.state}`);
        if (txData.signed_raw_transaction) {
            console.log(`Signed raw transaction: ${txData.signed_raw_transaction}`);
        }
        if (txData.signatures?.length) {
            const sigBytes = Buffer.from(txData.signatures[0], 'base64');
            console.log(`Raw signature: 0x${sigBytes.toString('hex')}`);
        }
        return {
            transactionId: txData.id,
            state: txData.state,
            signedRawTransaction: txData.signed_raw_transaction,
            signatures: txData.signatures,
            amount: formatUnits(amount, 6),
            user: fordefiConfig.address,
        };
    }

    // Poll for the transaction hash
    const txId = txData.id;
    console.log(`Transaction ID: ${txId} — polling for completion...`);
    const pollEndpoint = `/api/v1/transactions/${txId}`;
    const terminalStates = ['completed', 'mined', 'confirmed', 'failed', 'aborted', 'rejected'];
    const maxAttempts = 30;

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 3000));

        const pollTimestamp = new Date().getTime();
        const pollPayload = `${pollEndpoint}|${pollTimestamp}|`;
        const pollSignature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, pollPayload);

        const pollResponse = await axios.get(`https://api.fordefi.com${pollEndpoint}`, {
            headers: {
                Authorization: `Bearer ${fordefiConfig.accessToken}`,
                'x-signature': pollSignature,
                'x-timestamp': pollTimestamp,
            },
        });

        txData = pollResponse.data;
        const state = txData.state?.toLowerCase();
        console.log(`  Poll ${i + 1}: state = ${txData.state}`);

        if (terminalStates.includes(state)) break;
    }

    console.log(`Transaction hash: ${txData.hash ?? 'N/A'}`);
    return {
        transactionId: txData.id,
        transactionHash: txData.hash,
        state: txData.state,
        amount: formatUnits(amount, 6),
        user: fordefiConfig.address,
    };
};
