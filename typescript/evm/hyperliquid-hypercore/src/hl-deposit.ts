import axios from 'axios';
import { ethers, parseUnits, formatUnits } from 'ethers';
import { HyperliquidConfig, fordefiConfig } from './config'
import { FordefiWalletAdapter } from './wallet-adapter';
import { buildEvmTransactionPayload } from './api_request/buildPayload';
import { signWithApiUserPrivateKey } from './api_request/signer';
import { createAndSignTx } from './api_request/pushToApi';

// Function to split signature into r, s, v components
function splitSignatures(signature: string): { r: string; s: string; v: number } {
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);
    return { r, s, v };
};

export async function deposit(hyperliquidConfig: HyperliquidConfig) {
    const usdcAddress = hyperliquidConfig.usdcAddress ?? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const hyperliquidBridgeAddress = hyperliquidConfig.bridgeAddress ?? "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";

    // Read-only provider for fetching nonce
    const provider = new ethers.JsonRpcProvider(fordefiConfig.rpcUrl);
    const usdcContract = new ethers.Contract(
        usdcAddress,
        ["function nonces(address owner) view returns (uint256)"],
        provider,
    );

    const fordefiVault = fordefiConfig.address;
    const nonce = await (usdcContract as any).nonces(fordefiVault);

    // Validate the amount is at least 5 USDC
    const minAmount = 5;
    const amount = hyperliquidConfig?.amount
        ? parseFloat(hyperliquidConfig.amount)
        : 5;

    if (amount < minAmount) {
        throw new Error(`Deposit amount must be at least ${minAmount} USDC. Received: ${amount} USDC`);
    }

    const value = parseUnits(amount.toString(), 6).toString();
    const deadline = Math.floor(Date.now() / 1000 + 3600).toString(); // 1 hour from now

    const isMainnet = !hyperliquidConfig.isTestnet;

    const domain = {
        name: isMainnet ? "USD Coin" : "USDC2",
        version: isMainnet ? "2" : "1",
        chainId: isMainnet ? 42161 : 421614,
        verifyingContract: isMainnet
            ? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            : "0x1baAbB04529D43a73232B713C0FE471f7c7334d5",
    };

    const permitTypes = {
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };

    const permitMessage = {
        owner: fordefiVault,
        spender: hyperliquidBridgeAddress,
        value,
        nonce: nonce.toString(),
        deadline,
    };

    // Sign the EIP-712 Permit via the Fordefi wallet adapter
    // Override chainId to Arbitrum for the permit signing
    const permitConfig = { ...fordefiConfig, chainId: isMainnet ? 42161 : 421614 };
    const wallet = new FordefiWalletAdapter(permitConfig);
    const signature = await wallet.signTypedData(domain, permitTypes, permitMessage);

    const splitSignature = splitSignatures(signature);

    // ABI-encode the batchedDepositWithPermit call
    const bridgeInterface = new ethers.Interface([
        "function batchedDepositWithPermit(tuple(address user, uint64 usd, uint64 deadline, tuple(uint256 r, uint256 s, uint8 v) signature)[] deposits)"
    ]);

    const depositStruct = [{
        user: fordefiVault,
        usd: value,
        deadline,
        signature: {
            r: splitSignature.r,
            s: splitSignature.s,
            v: splitSignature.v,
        },
    }];

    const calldata = bridgeInterface.encodeFunctionData('batchedDepositWithPermit', [depositStruct]);

    console.log(`Depositing ${formatUnits(value, 6)} USDC to Hyperliquid bridge...`);

    // Submit the bridge transaction via Fordefi API
    const txEndpoint = '/api/v1/transactions';
    const txPayload = buildEvmTransactionPayload(
        fordefiConfig.vaultId,
        'arbitrum_mainnet',
        hyperliquidBridgeAddress,
        calldata,
        '0',
        'auto', // deposit must always broadcast
    );
    const txBody = JSON.stringify(txPayload);

    const txTimestamp = new Date().getTime();
    const txSigningPayload = `${txEndpoint}|${txTimestamp}|${txBody}`;
    const txApiSignature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, txSigningPayload);

    console.log(`Sending batchedDepositWithPermit transaction to Fordefi API...`);
    const txResponse = await createAndSignTx(
        txEndpoint,
        fordefiConfig.accessToken,
        txApiSignature,
        txTimestamp,
        txBody,
    );

    let txData = txResponse.data;

    // Poll for the transaction hash
    const txId = txData.id;
    console.log(`Transaction ID: ${txId} — polling for completion...`);
    const pollEndpoint = `/api/v1/transactions/${txId}`;
    const terminalStates = ['completed', 'mined', 'confirmed', 'failed', 'aborted', 'rejected'];
    const failureStates = ['failed', 'aborted', 'rejected'];
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

        if (failureStates.includes(state)) {
            throw new Error(`Transaction ${txId} failed with state: ${txData.state}`);
        }
        if (terminalStates.includes(state)) break;
    }

    if (!terminalStates.includes(txData.state?.toLowerCase())) {
        throw new Error(`Transaction ${txId} did not reach a terminal state after ${maxAttempts} polls. Last state: ${txData.state}`);
    }

    console.log(`Transaction confirmed! Hash: ${txData.hash ?? 'N/A'}`);
    return {
        transactionId: txData.id,
        transactionHash: txData.hash,
        state: txData.state,
        amount: formatUnits(value, 6),
        user: fordefiVault,
    };
};
