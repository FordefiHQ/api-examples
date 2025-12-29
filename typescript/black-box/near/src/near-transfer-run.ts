import axios from "axios";
import dotenv from "dotenv";
import { signWithPrivateKey } from './signer';
import { createAndSignTx } from './process_tx';
import { NearTransferConfig } from './interfaces';
import { fordefiNearConfig, NEAR_NETWORK } from "./near-config";
import { publicKeyToNearImplicitAddress } from "./derive_near_address";
import { buildNearTransferPayload } from "./near-transfer-serializer";
import { fetchAndBroadcastNearTransaction } from "./broadcast-near-transaction";

dotenv.config();

async function main() {
    try {
        console.log("=== Fordefi NEAR Transfer Flow ===\n");

        // Get the public key from environment
        const publicKeyBase64 = process.env.VAULT_PUBLIC_KEY;
        if (!publicKeyBase64) {
            throw new Error("VAULT_PUBLIC_KEY environment variable is required");
        }
        const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');

        // Derive the NEAR implicit address from public key
        const derivedNearAddress = publicKeyToNearImplicitAddress(publicKeyBuffer);
        console.log("Derived NEAR implicit address from public key:", derivedNearAddress);

        const destinationAddress = process.env.DESTINATION_ADDRESS || "";
        if (!destinationAddress) {
            throw new Error("DESTINATION_ADDRESS environment variable is required");
        }

        // Convert NEAR to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        const transferAmount = BigInt(Math.floor(fordefiNearConfig.transferAmount * 1e24));

        const transferConfig: NearTransferConfig = {
            originVault: fordefiNearConfig.originVault,
            originAddress: derivedNearAddress,
            destinationAddress,
            amount: transferAmount,
            accessToken: fordefiNearConfig.accessToken,
            privateKeyPem: fordefiNearConfig.privateKeyPem,
            apiPathEndpoint: fordefiNearConfig.apiPathEndpoint,
        };

        console.log("\nStep 1: Building NEAR transfer transaction...");
        console.log("From address:", transferConfig.originAddress);
        console.log("To address:", transferConfig.destinationAddress);
        console.log("Amount:", transferAmount.toString(), "yoctoNEAR");

        const { payload, rawTransactionHash, transaction, publicKey } = await buildNearTransferPayload(transferConfig);

        console.log("\n=== Transaction Details ===");
        console.log("Raw transaction hash:", rawTransactionHash);

        const requestBody = JSON.stringify(payload);
        const timestamp = new Date().getTime();
        const requestPayload = `${fordefiNearConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
        const signature = await signWithPrivateKey(requestPayload, fordefiNearConfig.privateKeyPem);

        console.log("\n\nStep 2: Sending transaction to Fordefi for signing...");
        console.log("Vault ID:", transferConfig.originVault);

        const fordefiResponse = await createAndSignTx(
            transferConfig.apiPathEndpoint,
            transferConfig.accessToken,
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
        console.log("\nStep 3: Fetching signature and broadcasting to NEAR...");

        const result = await fetchAndBroadcastNearTransaction(
            transaction,
            publicKey,
            transactionId,
            transferConfig.accessToken,
            transferConfig.apiPathEndpoint
        );

        console.log("\n\n=== SUCCESS ===");
        console.log("Transaction hash:", result.txId);
        console.log("Transaction Status:", JSON.stringify(result.status, null, 2));

        const explorerUrl = NEAR_NETWORK === 'mainnet'
            ? `https://nearblocks.io/txns/${result.txId}`
            : `https://testnet.nearblocks.io/txns/${result.txId}`;
        console.log(`View on explorer: ${explorerUrl}`);

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
