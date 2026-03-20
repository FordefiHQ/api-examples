import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { signWithPrivateKey } from "../signer";
import { createAndSignTx } from "../process_tx";
import { fordefiNearConfig, NEAR_NETWORK, WNEAR_CONTRACT } from "../near-config";
import { publicKeyToNearImplicitAddress } from "../derive_near_address";
import { fetchAndBroadcastNearTransaction } from "../broadcast-near-transaction";
import { buildWrapNearPayload } from "./near-wrap-serializer";
import { buildDepositPayload } from "./intents-deposit-serializer";
import { getQuote, submitDeposit, pollStatus } from "./oneclick-api";
import { OneClickQuoteRequest } from "./intents-interfaces";

dotenv.config();

interface AssetEntry {
    assetId: string;
    symbol: string;
    decimals: number;
    blockchain: string;
    contractAddress?: string;
}

interface SwapConfig {
    originAsset: string;       // 1Click assetId (e.g. "nep141:eth.omft.near")
    destinationAsset: string;
    amount: string;            // Human-readable amount (e.g. "1.0")
    recipient: string;
    refundTo?: string;         // Refund address on origin chain (defaults to NEAR address for NEAR-origin swaps)
    slippageBps: number;
}

const WNEAR_ASSET_ID = "nep141:wrap.near";

function loadSwapConfig(): SwapConfig {
    const configPath = path.join(__dirname, "swap-config.json");
    if (!fs.existsSync(configPath)) {
        throw new Error(`Swap config not found at ${configPath}. Create it from the template and edit it.`);
    }
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function loadAssets(): AssetEntry[] {
    const assetsPath = path.join(__dirname, "assets.json");
    if (!fs.existsSync(assetsPath)) {
        throw new Error(
            `assets.json not found at ${assetsPath}.\n` +
            `Fetch it with: curl -s https://1click.chaindefuser.com/v0/tokens > src/intents/assets.json`
        );
    }
    return JSON.parse(fs.readFileSync(assetsPath, "utf-8"));
}

function findAsset(assetId: string, assets: AssetEntry[]): AssetEntry {
    const entry = assets.find((a) => a.assetId === assetId);
    if (!entry) {
        throw new Error(`Asset "${assetId}" not found in assets.json. Run: curl -s https://1click.chaindefuser.com/v0/tokens > src/intents/assets.json`);
    }
    return entry;
}

function toSmallestUnit(amount: string, decimals: number): string {
    const [whole, frac = ""] = amount.split(".");
    const padded = frac.padEnd(decimals, "0").slice(0, decimals);
    const raw = whole + padded;
    // Strip leading zeros but keep at least "0"
    return raw.replace(/^0+/, "") || "0";
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

        // --- Load config ---
        const swap = loadSwapConfig();
        const assets = loadAssets();

        const publicKeyBase64 = process.env.VAULT_PUBLIC_KEY;
        if (!publicKeyBase64) {
            throw new Error("VAULT_PUBLIC_KEY environment variable is required");
        }

        const apiKey = process.env.ONECLICK_API_KEY || undefined;

        // Step 1: Derive NEAR address
        const publicKeyBuffer = Buffer.from(publicKeyBase64, "base64");
        const nearAddress = publicKeyToNearImplicitAddress(publicKeyBuffer);
        console.log("NEAR address:", nearAddress);

        // Step 2: Resolve tokens from assets.json
        const originAsset = findAsset(swap.originAsset, assets);
        const destAsset = findAsset(swap.destinationAsset, assets);
        const isNativeNear = swap.originAsset === WNEAR_ASSET_ID || swap.originAsset === "near:mainnet:native";
        const originAssetId = isNativeNear ? WNEAR_ASSET_ID : swap.originAsset;
        const amountRaw = toSmallestUnit(swap.amount, originAsset.decimals);

        console.log(`Swap: ${originAsset.symbol} (${originAssetId}) → ${destAsset.symbol} (${swap.destinationAsset})`);
        console.log(`Amount: ${swap.amount} ${originAsset.symbol} (${amountRaw} raw)`);
        console.log(`Recipient: ${swap.recipient}`);

        // Step 3: Dry quote (preview)
        console.log("\n--- Step 1: Preview quote ---");
        const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const quoteRequest: OneClickQuoteRequest = {
            dry: true,
            swapType: "EXACT_INPUT",
            originAsset: originAssetId,
            destinationAsset: swap.destinationAsset,
            amount: amountRaw,
            recipient: swap.recipient,
            refundTo: swap.refundTo || nearAddress,
            slippageTolerance: swap.slippageBps,
            depositType: "ORIGIN_CHAIN",
            recipientType: "DESTINATION_CHAIN",
            refundType: "ORIGIN_CHAIN",
            deadline,
        };

        const dryQuote = await getQuote(quoteRequest, apiKey);
        console.log(`Estimated output: ${dryQuote.quote.amountOutFormatted}`);

        // Step 4: Committed quote
        console.log("\n--- Step 2: Committed quote ---");
        const committedQuote = await getQuote(
            { ...quoteRequest, dry: false },
            apiKey
        );
        console.log(`Quote ID: ${committedQuote.correlationId}`);
        console.log(`Deposit address: ${committedQuote.quote.depositAddress}`);
        console.log(`Deposit amount: ${committedQuote.quote.amountIn}`);
        console.log(`Deadline: ${committedQuote.quote.deadline}`);

        // Step 5: If native NEAR, wrap first
        let tokenContract: string;
        let depositAmount: string;
        let nextNonce: number | undefined;

        if (isNativeNear) {
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
            // NEP-141 token — extract contract from assetId (e.g. "nep141:usdt.tether-token.near" → "usdt.tether-token.near")
            const parts = originAssetId.split(":");
            tokenContract = parts.length === 2 ? parts[1] : originAssetId;
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
        const status = await pollStatus(committedQuote.quote.depositAddress, apiKey);

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
