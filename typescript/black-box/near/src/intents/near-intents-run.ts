import axios from "axios";
import dotenv from "dotenv";
import { signWithPrivateKey } from "../signer";
import { createAndSignTx } from "../process_tx";
import { fordefiNearConfig, NEAR_NETWORK, WNEAR_CONTRACT } from "../near-config";
import { publicKeyToNearImplicitAddress } from "../derive_near_address";
import { fetchAndBroadcastNearTransaction } from "../broadcast-near-transaction";
import { buildWrapNearPayload } from "./near-wrap-serializer";
import { buildDepositPayload } from "./intents-deposit-serializer";
import { getQuote, fetchTokens, submitDeposit, pollStatus } from "./oneclick-api";
import { OneClickQuoteRequest, OneClickToken } from "./intents-interfaces";

dotenv.config();

// Maps legacy "chain:network:address" env values to token-list lookups
const LEGACY_ASSET_MAP: Record<string, { symbol: string; blockchain: string }> = {
    "near:mainnet:native": { symbol: "NEAR", blockchain: "near" },
    "eth:1:native": { symbol: "ETH", blockchain: "eth" },
    "eth:1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", blockchain: "eth" },
};

/**
 * Resolves an asset identifier to a 1Click assetId.
 * Accepts either a 1Click assetId directly (e.g. "nep141:wrap.near")
 * or a legacy "chain:network:address" format (looked up via /v0/tokens).
 */
async function resolveAssetId(
    input: string,
    tokens: OneClickToken[]
): Promise<{ assetId: string; isNativeNear: boolean }> {
    // If it already looks like a 1Click assetId (e.g. "nep141:..." or contains no second colon after prefix)
    const colonCount = (input.match(/:/g) || []).length;
    if (colonCount <= 1) {
        // Already a 1Click assetId
        return { assetId: input, isNativeNear: false };
    }

    // Legacy format — check known mappings first, then try matching by blockchain
    const mapped = LEGACY_ASSET_MAP[input.toLowerCase()];
    if (mapped) {
        // Special case: native NEAR must be swapped as wNEAR via 1Click
        if (input.toLowerCase() === "near:mainnet:native") {
            const wNear = tokens.find(
                (t) => t.symbol === "wNEAR" && t.blockchain === "near"
            );
            if (!wNear) throw new Error("wNEAR token not found in 1Click token list");
            return { assetId: wNear.assetId, isNativeNear: true };
        }
        const token = tokens.find(
            (t) =>
                t.symbol.toLowerCase() === mapped.symbol.toLowerCase() &&
                t.blockchain === mapped.blockchain
        );
        if (!token) throw new Error(`Token ${mapped.symbol} on ${mapped.blockchain} not found in 1Click token list`);
        return { assetId: token.assetId, isNativeNear: false };
    }

    throw new Error(
        `Unrecognized asset format: "${input}". Use a 1Click assetId from /v0/tokens ` +
        `(e.g. "nep141:wrap.near") or a supported legacy format (e.g. "near:mainnet:native").`
    );
}

/**
 * Signs a Fordefi payload, broadcasts the NEAR transaction, and returns the on-chain tx hash.
 */
async function signAndBroadcast(
    payload: any,
    transaction: any,
    publicKey: any,
    label: string
): Promise<string> {
    const requestBody = JSON.stringify(payload);
    const timestamp = new Date().getTime();
    const requestPayload = `${fordefiNearConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
    const signature = await signWithPrivateKey(requestPayload, fordefiNearConfig.privateKeyPem);

    console.log(`\nSending ${label} to Fordefi for signing...`);

    const fordefiResponse = await createAndSignTx(
        fordefiNearConfig.apiPathEndpoint,
        fordefiNearConfig.accessToken,
        signature,
        timestamp,
        requestBody
    );

    const transactionId = fordefiResponse.data.id;
    console.log(`Fordefi transaction ID: ${transactionId}`);

    console.log("Waiting for signature...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Fetching signature and broadcasting to NEAR...");
    const result = await fetchAndBroadcastNearTransaction(
        transaction,
        publicKey,
        transactionId,
        fordefiNearConfig.accessToken,
        fordefiNearConfig.apiPathEndpoint
    );

    console.log(`${label} broadcast successful. TX hash: ${result.txId}`);
    return result.txId;
}

async function main() {
    try {
        console.log("=== Fordefi NEAR Intents (1Click) Flow ===\n");

        // --- Validate config ---
        const publicKeyBase64 = process.env.VAULT_PUBLIC_KEY;
        if (!publicKeyBase64) {
            throw new Error("VAULT_PUBLIC_KEY environment variable is required");
        }

        const intentsConfig = fordefiNearConfig.intents;
        if (!intentsConfig) {
            throw new Error("Intents configuration is missing. Set INTENTS_* env vars.");
        }

        // Step 1: Derive NEAR address
        const publicKeyBuffer = Buffer.from(publicKeyBase64, "base64");
        const nearAddress = publicKeyToNearImplicitAddress(publicKeyBuffer);
        console.log("NEAR address:", nearAddress);

        // Step 2: Resolve asset IDs via 1Click token list
        console.log("\nFetching 1Click token list...");
        const tokens = await fetchTokens();
        const origin = await resolveAssetId(intentsConfig.originAsset, tokens);
        const dest = await resolveAssetId(intentsConfig.destinationAsset, tokens);
        console.log(`Swap: ${origin.assetId} → ${dest.assetId}`);
        console.log(`Amount: ${intentsConfig.amount}`);
        console.log(`Recipient: ${intentsConfig.recipient}`);

        // Step 3: Dry quote (preview)
        console.log("\n--- Step 1: Preview quote ---");
        const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const quoteRequest: OneClickQuoteRequest = {
            dry: true,
            swapType: "EXACT_INPUT",
            originAsset: origin.assetId,
            destinationAsset: dest.assetId,
            amount: intentsConfig.amount,
            recipient: intentsConfig.recipient,
            refundTo: nearAddress,
            slippageTolerance: intentsConfig.slippage,
            depositType: "ORIGIN_CHAIN",
            recipientType: "DESTINATION_CHAIN",
            refundType: "ORIGIN_CHAIN",
            deadline,
        };

        const dryQuote = await getQuote(quoteRequest, intentsConfig.apiKey);
        console.log(`Estimated output: ${dryQuote.quote.amountOutFormatted}`);

        // Step 4: Committed quote
        console.log("\n--- Step 2: Committed quote ---");
        const committedQuote = await getQuote(
            { ...quoteRequest, dry: false },
            intentsConfig.apiKey
        );
        console.log(`Quote ID: ${committedQuote.correlationId}`);
        console.log(`Deposit address: ${committedQuote.quote.depositAddress}`);
        console.log(`Deposit amount: ${committedQuote.quote.amountIn}`);
        console.log(`Deadline: ${committedQuote.quote.deadline}`);

        // Step 5: If native NEAR, wrap first
        let tokenContract: string;
        let depositAmount: string;
        let nextNonce: number | undefined;

        if (origin.isNativeNear) {
            console.log("\n--- Step 3: Wrapping NEAR → wNEAR ---");
            const wrapAmount = BigInt(committedQuote.quote.amountIn);

            const wrapResult = await buildWrapNearPayload({
                originVault: fordefiNearConfig.originVault,
                originAddress: nearAddress,
                amount: wrapAmount,
            });

            await signAndBroadcast(
                wrapResult.payload,
                wrapResult.transaction,
                wrapResult.publicKey,
                "wrap NEAR → wNEAR"
            );

            tokenContract = WNEAR_CONTRACT;
            depositAmount = committedQuote.quote.amountIn;
            nextNonce = wrapResult.nonce + 1;
        } else {
            // Direct NEP-141 token — extract contract from assetId (e.g. "nep141:usdt.tether-token.near")
            const parts = origin.assetId.split(":");
            tokenContract = parts.length === 2 ? parts[1] : origin.assetId;
            depositAmount = committedQuote.quote.amountIn;
        }

        // Step 6: ft_transfer to deposit address
        console.log("\n--- Step 4: Depositing tokens to 1Click ---");
        const depositResult = await buildDepositPayload({
            originVault: fordefiNearConfig.originVault,
            originAddress: nearAddress,
            tokenContract,
            depositAddress: committedQuote.quote.depositAddress,
            amount: depositAmount,
            nonceOverride: nextNonce,
        });

        const depositTxHash = await signAndBroadcast(
            depositResult.payload,
            depositResult.transaction,
            depositResult.publicKey,
            "ft_transfer deposit"
        );

        // Step 7: Submit deposit TX hash to 1Click
        console.log("\n--- Step 5: Submitting deposit to 1Click ---");
        await submitDeposit(committedQuote.quote.depositAddress, depositTxHash, nearAddress);
        console.log("Deposit submitted to 1Click");

        // Step 8: Poll for swap completion
        console.log("\n--- Step 6: Polling for swap completion ---");
        const status = await pollStatus(committedQuote.quote.depositAddress, intentsConfig.apiKey);

        // Step 9: Log result
        console.log("\n=== RESULT ===");
        console.log(`Status: ${status.status}`);
        if (status.swapDetails?.destinationChainTxHashes?.length) {
            for (const tx of status.swapDetails.destinationChainTxHashes) {
                console.log(`Destination TX: ${tx.hash} (${tx.explorerUrl})`);
            }
        }
        if (status.swapDetails?.refundedAmount) {
            console.log(`Refunded: ${status.swapDetails.refundedAmount} — ${status.swapDetails.refundReason}`);
        }

        const explorerUrl = NEAR_NETWORK === "mainnet"
            ? `https://nearblocks.io/txns/${depositTxHash}`
            : `https://testnet.nearblocks.io/txns/${depositTxHash}`;
        console.log(`NEAR deposit TX: ${explorerUrl}`);

        if (status.status !== "SUCCESS") {
            console.error(`Swap did not succeed. Status: ${status.status}`);
            process.exit(1);
        }

        console.log("\nSwap completed successfully!");

    } catch (error) {
        console.error("\n=== ERROR ===");
        if (axios.isAxiosError(error)) {
            console.error("Status:", error.response?.status);
            console.error("Data:", JSON.stringify(error.response?.data, null, 2));
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

main();
