import { ethers, parseUnits, formatUnits } from 'ethers';
import { HyperliquidConfig, fordefiConfig } from './config'
import { buildTypedMessagePayload, buildEvmTransactionPayload } from './api_request/buildPayload';
import { signWithApiUserPrivateKey } from './api_request/signer';
import { createAndSignTx } from './api_request/pushToApi';

interface PermitPayload {
    owner: string;
    spender: string;
    value: string;
    nonce: string;
    deadline: string;
};

function splitSignatures(signature: string): { r: string; s: string; v: number } {
    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);
    return { r, s, v };
};

/**
 * Sign EIP-712 typed data directly via the Fordefi API.
 * Used for the Permit signature (chainId 42161), bypassing the wallet adapter
 * which overrides chainId to 1337.
 */
async function signTypedDataViaApi(
    domain: Record<string, any>,
    types: Record<string, Array<{ name: string; type: string }>>,
    message: Record<string, any>,
    primaryType: string,
) {
    // Build EIP712Domain type from domain fields
    const eip712DomainFields: Array<{ name: string; type: string }> = [];
    if (domain.name !== undefined) eip712DomainFields.push({ name: "name", type: "string" });
    if (domain.version !== undefined) eip712DomainFields.push({ name: "version", type: "string" });
    if (domain.chainId !== undefined) eip712DomainFields.push({ name: "chainId", type: "uint256" });
    if (domain.verifyingContract !== undefined) eip712DomainFields.push({ name: "verifyingContract", type: "address" });

    const eip712Json = {
        types: { EIP712Domain: eip712DomainFields, ...types },
        domain,
        primaryType,
        message,
    };

    const jsonStr = JSON.stringify(eip712Json, (_key, val) =>
        typeof val === 'bigint' ? val.toString() : val
    );
    const rawData = '0x' + Buffer.from(jsonStr, 'utf-8').toString('hex');

    const chain = `evm_${domain.chainId}`;
    const requestJson = buildTypedMessagePayload(fordefiConfig.vaultId, rawData, chain);
    const requestBody = JSON.stringify(requestJson);

    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`;
    const apiSignature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, payload);

    console.log("Sending Permit signing request to Fordefi API...");
    const response = await createAndSignTx(
        fordefiConfig.pathEndpoint,
        fordefiConfig.accessToken,
        apiSignature,
        timestamp,
        requestBody,
    );

    if (!response.data.signatures || response.data.signatures.length === 0) {
        throw new Error(`No signatures returned. Response state: ${response.data.state}`);
    }

    const signatureB64 = response.data.signatures[0];
    const signatureBytes = Buffer.from(signatureB64, 'base64');
    return '0x' + signatureBytes.toString('hex');
}

export async function deposit(hyperliquidConfig: HyperliquidConfig) {
    // Use a plain JSON-RPC provider for on-chain reads (USDC nonce)
    const rpcProvider = new ethers.JsonRpcProvider(fordefiConfig.rpcUrl);

    const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum USDC
    const usdcAbi = ["function nonces(address owner) view returns (uint256)"];
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, rpcProvider);

    const fordefiVault = fordefiConfig.address;
    const hyperliquidBridgeAddress = "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7"; // Mainnet bridge contract

    // Get the current nonce for the vault address
    const nonce = await (usdcContract as any).nonces(fordefiVault);

    // Validate the amount is at least 5 USDC
    const minAmount = 5;
    const amount = hyperliquidConfig?.amount
        ? parseFloat(hyperliquidConfig.amount)
        : 5;

    if (amount < minAmount) {
        throw new Error(`Deposit amount must be at least ${minAmount} USDC. Received: ${amount} USDC`);
    }

    // Convert amount to smallest units (1 USDC = 1000000)
    const value = parseUnits(amount.toString(), 6).toString();

    const deadline = Math.floor(Date.now() / 1000 + 3600).toString(); // 1 hour from now

    const payload: PermitPayload = {
        owner: fordefiVault,
        spender: hyperliquidBridgeAddress,
        value,
        nonce: nonce.toString(),
        deadline
    };

    const isMainnet = !hyperliquidConfig.isTestnet;

    const domain = {
        name: isMainnet ? "USD Coin" : "USDC2",
        version: isMainnet ? "2" : "1",
        chainId: isMainnet ? 42161 : 421614,
        verifyingContract: isMainnet ? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" : "0x1baAbB04529D43a73232B713C0FE471f7c7334d5",
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

    // Step 1: Sign the EIP-712 Permit via Fordefi API
    const signature = await signTypedDataViaApi(domain, permitTypes, payload, "Permit");

    console.log('Signature:', signature);
    const splitSignature = splitSignatures(signature);
    console.log('Split signature:', splitSignature);

    // Step 2: ABI-encode the bridge contract call
    const bridgeAbi = [
        "function batchedDepositWithPermit(tuple(address user, uint64 usd, uint64 deadline, tuple(uint256 r, uint256 s, uint8 v) signature)[] deposits) external"
    ];

    const signatureStruct = {
        r: splitSignature.r,
        s: splitSignature.s,
        v: splitSignature.v
    };

    const depositStruct = [{
        user: fordefiVault,
        usd: value,
        deadline,
        signature: signatureStruct
    }];

    console.log(`Depositing ${formatUnits(value, 6)} USDC to Hyperliquid bridge...`);

    // Encode the calldata
    const bridgeInterface = new ethers.Interface(bridgeAbi);
    const calldata = bridgeInterface.encodeFunctionData('batchedDepositWithPermit', [depositStruct]);

    // Step 3: Send the bridge contract call via Fordefi API
    // Use create-and-wait for manual mode so we get the signed tx back;
    // use regular endpoint for auto mode since the tx will be broadcast.
    const txEndpoint = fordefiConfig.pushMode === 'manual'
        ? '/api/v1/transactions/create-and-wait'
        : '/api/v1/transactions';
    const txPayload = buildEvmTransactionPayload(
        fordefiConfig.vaultId,
        'arbitrum_mainnet',
        hyperliquidBridgeAddress,
        calldata,
        '0',
        fordefiConfig.pushMode,
    );
    // For manual mode, add wait_for_state so the API blocks until signing completes
    if (fordefiConfig.pushMode === 'manual') {
        (txPayload as any).wait_for_state = 'signed';
        (txPayload as any).timeout = 45;
    }
    const txBody = JSON.stringify(txPayload);

    const txTimestamp = new Date().getTime();
    const txSigningPayload = `${txEndpoint}|${txTimestamp}|${txBody}`;
    const txApiSignature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, txSigningPayload);

    console.log(`Sending bridge transaction to Fordefi API (push_mode: ${fordefiConfig.pushMode})...`);
    const txResponse = await createAndSignTx(
        txEndpoint,
        fordefiConfig.accessToken,
        txApiSignature,
        txTimestamp,
        txBody,
    );

    const txData = txResponse.data;

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
            amount: formatUnits(value, 6),
            user: fordefiVault,
        };
    }

    return {
        transactionId: txData.id,
        transactionHash: txData.hash,
        amount: formatUnits(value, 6),
        user: fordefiVault
    };
};
