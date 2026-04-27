import axios from "axios";
import dotenv from "dotenv";
import { signWithPrivateKey } from './signer';
import { createAndSignTx } from './process_tx';
import { fordefiPChainConfig } from "./pchain-config";
import { buildPChainStakingPayload } from "./pchain-staking-serializer";
import { publicKeyToPChainAddressCompat } from "./pchain-address-utils";
import { fetchAndBroadcastPChainTransaction } from "./broadcast-pchain-transaction";

dotenv.config();

async function main() {
    try {
        console.log("=== Fordefi P-Chain Staking Flow ===\n");

        // Get the public key from environment
        const publicKeyBase64 = process.env.VAULT_PUBLIC_KEY || "AylGVK5wbcLMJ5xQ32LlXUyXhP73WNzcF/o2ho+/nj8n";
        const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');

        // Derive the correct P-Chain address from public key
        const derivedPChainAddress = await publicKeyToPChainAddressCompat(publicKeyBuffer);
        console.log("Derived P-Chain address from public key:", derivedPChainAddress);

        // Update config with derived address
        const stakingConfig = {
            ...fordefiPChainConfig,
            originAddress: derivedPChainAddress
        };

        // Step 1: Build the P-Chain staking transaction
        console.log("\nStep 1: Building P-Chain delegation transaction...");
        const { payload, rawTransactionHash, txHex, unsignedTx } = await buildPChainStakingPayload(stakingConfig);

        console.log("\n=== Transaction Details ===");
        console.log("Raw transaction hash:", rawTransactionHash);
        console.log("Transaction hex:", txHex.substring(0, 100) + "...");

        const requestBody = JSON.stringify(payload);
        const timestamp = new Date().getTime();
        const requestPayload = `${fordefiPChainConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
        const signature = await signWithPrivateKey(requestPayload, fordefiPChainConfig.privateKeyPem);

        // Step 2: Send to Fordefi for signing
        console.log("\n\nStep 2: Sending transaction to Fordefi for signing...");
        console.log("Vault ID:", fordefiPChainConfig.originVault);

        const fordefiResponse = await createAndSignTx(
            fordefiPChainConfig.apiPathEndpoint,
            fordefiPChainConfig.accessToken,
            signature,
            timestamp,
            requestBody
        );

        console.log("Fordefi response:", fordefiResponse.data);
        const transactionId = fordefiResponse.data.id;
        console.log(`Fordefi transaction ID: ${transactionId}`);

        // Wait for signature
        console.log("\nWaiting for signature...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3 & 4: Fetch signature and broadcast
        console.log("\nStep 3: Fetching signature and broadcasting to P-Chain...");

        const result = await fetchAndBroadcastPChainTransaction(
            unsignedTx,
            transactionId,
            fordefiPChainConfig.accessToken,
            fordefiPChainConfig.apiPathEndpoint
        );

        console.log("\n\n=== SUCCESS ===");
        console.log("Transaction ID:", result.txId);
        console.log("Transaction Status:", result.status);
        console.log(`View on explorer: https://subnets.avax.network/p-chain/tx/${result.txId}`);

    } catch (error) {
        console.error("\n\n=== ERROR ===");
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
