import axios from "axios";
import dotenv from "dotenv";
import { signWithPrivateKey } from './signer';
import { createAndSignTx } from './process_tx';
import { NearStakingConfig } from './interfaces';
import { fordefiNearConfig, NEAR_NETWORK } from "./near-config";
import { publicKeyToNearImplicitAddress } from "./derive_near_address";
import { buildNearStakingPayload } from "./near-staking-serializer";
import { fetchAndBroadcastNearTransaction } from "./broadcast-near-transaction";

dotenv.config();

async function main() {
    try {
        console.log("=== Fordefi NEAR Staking Flow ===\n");

        // Get the public key from environment
        const publicKeyBase64 = process.env.VAULT_PUBLIC_KEY;
        if (!publicKeyBase64) {
            throw new Error("VAULT_PUBLIC_KEY environment variable is required");
        }
        const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');

        // Derive the NEAR implicit address from public key
        const derivedNearAddress = publicKeyToNearImplicitAddress(publicKeyBuffer);
        console.log("Derived NEAR implicit address from public key:", derivedNearAddress);

        const stakingPoolId = fordefiNearConfig.stakingPoolId;
        if (!stakingPoolId) {
            throw new Error("STAKING_POOL_ID environment variable is required (e.g., 'figment.poolv1.near')");
        }

        // Convert NEAR to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        const stakeAmount = BigInt(Math.floor(fordefiNearConfig.stakeAmount * 1e24));

        const stakingConfig: NearStakingConfig = {
            originVault: fordefiNearConfig.originVault,
            originAddress: derivedNearAddress,
            stakingPoolId,
            amount: stakeAmount,
            accessToken: fordefiNearConfig.accessToken,
            privateKeyPem: fordefiNearConfig.privateKeyPem,
            apiPathEndpoint: fordefiNearConfig.apiPathEndpoint,
        };

        console.log("\nStep 1: Building NEAR staking transaction...");
        console.log("From address:", stakingConfig.originAddress);
        console.log("Staking pool:", stakingConfig.stakingPoolId);
        console.log("Amount:", stakeAmount.toString(), "yoctoNEAR");
        console.log("Amount:", fordefiNearConfig.stakeAmount, "NEAR");

        const { payload, rawTransactionHash, transaction, publicKey } = await buildNearStakingPayload(stakingConfig);

        console.log("\n=== Transaction Details ===");
        console.log("Raw transaction hash:", rawTransactionHash);

        const requestBody = JSON.stringify(payload);
        const timestamp = new Date().getTime();
        const requestPayload = `${fordefiNearConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
        const signature = await signWithPrivateKey(requestPayload, fordefiNearConfig.privateKeyPem);

        console.log("\n\nStep 2: Sending transaction to Fordefi for signing...");
        console.log("Vault ID:", stakingConfig.originVault);

        const fordefiResponse = await createAndSignTx(
            stakingConfig.apiPathEndpoint,
            stakingConfig.accessToken,
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
            stakingConfig.accessToken,
            stakingConfig.apiPathEndpoint
        );

        console.log("\n\n=== SUCCESS ===");
        console.log("Transaction hash:", result.txId);
        console.log("Transaction Status:", JSON.stringify(result.status, null, 2));

        const explorerUrl = NEAR_NETWORK === 'mainnet'
            ? `https://nearblocks.io/txns/${result.txId}`
            : `https://testnet.nearblocks.io/txns/${result.txId}`;
        console.log(`View on explorer: ${explorerUrl}`);

        console.log("\nNote: Your tokens are now staked. To unstake, call 'unstake' or 'unstake_all' on the staking pool.");
        console.log("Unstaking has a ~48 hour (4 epoch) unbonding period before withdrawal.");

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
